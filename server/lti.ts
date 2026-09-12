// server/lti.ts — LTI 1.3 tool: OIDC login, launch (JWT verify), JWKS, and the
// host-only "wrap session" that pushes grades through AGS.
//
// Privacy (AGENTS §5 / STANDARDS §10): the platform may send name/email
// claims; they are never read or stored. The only identity kept is the
// opaque `sub` (needed by AGS to post a score) and a hash of it for the
// player mapping. Scopes requested: lineitem/score only.
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { SignJWT, jwtVerify, createRemoteJWKSet, generateKeyPair, exportJWK, exportPKCS8, importPKCS8, type JWK, type JWTVerifyGetKey } from "jose";
import type { Db } from "./db";

export interface LtiConfig {
  issuer: string;
  clientId: string;
  deploymentId: string;
  authUrl: string;
  tokenUrl: string;
  jwksUrl: string;
  /** This server's public base URL (https://thebar-server.fly.dev). */
  publicUrl: string;
  /** The game client base URL (https://crskkk.github.io/trustcamp/). */
  clientUrl: string;
  /** WebSocket URL the client should use (default: publicUrl with ws scheme). */
  wsUrl?: string;
  privateKeyPem?: string;
  keyPath?: string;
  kid?: string;
}

export interface LtiDeps {
  fetchImpl?: typeof fetch;
  /** Platform key resolver (tests inject a local JWKS). */
  getKey?: JWTVerifyGetKey;
  now?: () => number;
}

export const CLAIM = {
  messageType: "https://purl.imsglobal.org/spec/lti/claim/message_type",
  version: "https://purl.imsglobal.org/spec/lti/claim/version",
  deployment: "https://purl.imsglobal.org/spec/lti/claim/deployment_id",
  context: "https://purl.imsglobal.org/spec/lti/claim/context",
  resourceLink: "https://purl.imsglobal.org/spec/lti/claim/resource_link",
  roles: "https://purl.imsglobal.org/spec/lti/claim/roles",
  ags: "https://purl.imsglobal.org/spec/lti-ags/claim/endpoint",
  nrps: "https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice",
} as const;

export const SCOPE_SCORE = "https://purl.imsglobal.org/spec/lti-ags/scope/score";
const STATE_TTL_MS = 5 * 60 * 1000;

export function ltiConfigFromEnv(env: NodeJS.ProcessEnv = process.env): LtiConfig | null {
  if (!env.LTI_ISSUER || !env.LTI_CLIENT_ID) return null;
  const issuer = env.LTI_ISSUER.replace(/\/$/, "");
  return {
    issuer,
    clientId: env.LTI_CLIENT_ID,
    deploymentId: env.LTI_DEPLOYMENT_ID ?? "1",
    authUrl: env.LTI_AUTH_URL ?? `${issuer}/mod/lti/auth.php`,
    tokenUrl: env.LTI_TOKEN_URL ?? `${issuer}/mod/lti/token.php`,
    jwksUrl: env.LTI_JWKS_URL ?? `${issuer}/mod/lti/certs.php`,
    publicUrl: (env.PUBLIC_URL ?? `http://localhost:${env.PORT ?? 8787}`).replace(/\/$/, ""),
    clientUrl: env.CLIENT_URL ?? "http://localhost:5173/",
    wsUrl: env.WS_URL,
    privateKeyPem: env.LTI_PRIVATE_KEY,
    keyPath: env.LTI_KEY_PATH ?? "data/lti-key.pem",
  };
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Insert `/scores` before the query string of a lineitem URL (AGS). */
export function scoresUrl(lineitem: string): string {
  const i = lineitem.indexOf("?");
  return i === -1 ? `${lineitem}/scores` : `${lineitem.slice(0, i)}/scores${lineitem.slice(i)}`;
}

export class Lti {
  private privateKey!: CryptoKey;
  private publicJwk!: JWK;
  private readonly kid: string;
  private readonly states = new Map<string, { nonce: string; exp: number }>();

  constructor(readonly cfg: LtiConfig, private readonly db: Db, private readonly deps: LtiDeps = {}) {
    this.kid = cfg.kid ?? "thebar-1";
  }

  private now(): number {
    return this.deps.now?.() ?? Date.now();
  }

  /** Load the tool key (env PEM, key file, or generate + persist one). */
  async init(): Promise<void> {
    let pem = this.cfg.privateKeyPem;
    if (!pem && this.cfg.keyPath && existsSync(this.cfg.keyPath)) pem = readFileSync(this.cfg.keyPath, "utf8");
    if (!pem) {
      const { privateKey } = await generateKeyPair("RS256", { modulusLength: 2048, extractable: true });
      pem = await exportPKCS8(privateKey);
      if (this.cfg.keyPath) {
        mkdirSync(dirname(this.cfg.keyPath), { recursive: true });
        writeFileSync(this.cfg.keyPath, pem, { mode: 0o600 });
      }
    }
    this.privateKey = await importPKCS8(pem, "RS256", { extractable: true });
    const full = await exportJWK(this.privateKey);
    this.publicJwk = { kty: full.kty, n: full.n, e: full.e };
  }

  jwks(): { keys: JWK[] } {
    return { keys: [{ ...this.publicJwk, kid: this.kid, alg: "RS256", use: "sig" }] };
  }

  /** Moodle "Tool configuration details" as JSON (LTI Advantage). */
  toolConfig(): Record<string, unknown> {
    return {
      title: "THE BAR",
      description: "Camp mini-planet game with live leaderboard; grades pushed on session wrap.",
      oidc_initiation_url: `${this.cfg.publicUrl}/lti/login`,
      target_link_uri: `${this.cfg.publicUrl}/lti/launch`,
      public_jwk_url: `${this.cfg.publicUrl}/lti/jwks`,
      scopes: [SCOPE_SCORE, "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly"],
      claims: ["sub", "iss"],
      privacy: { share_name: false, share_email: false },
    };
  }

  /** OIDC third-party-initiated login: returns the platform auth redirect URL. */
  login(q: Record<string, string | undefined>): string {
    if (!q.iss || q.iss.replace(/\/$/, "") !== this.cfg.issuer) throw new Error("unknown issuer");
    if (!q.login_hint) throw new Error("missing login_hint");
    const state = randomBytes(16).toString("hex");
    const nonce = randomBytes(16).toString("hex");
    for (const [k, v] of this.states) if (v.exp < this.now()) this.states.delete(k);
    this.states.set(state, { nonce, exp: this.now() + STATE_TTL_MS });
    const u = new URL(this.cfg.authUrl);
    const params: Record<string, string> = {
      scope: "openid", response_type: "id_token", response_mode: "form_post", prompt: "none",
      client_id: q.client_id ?? this.cfg.clientId, redirect_uri: `${this.cfg.publicUrl}/lti/launch`,
      login_hint: q.login_hint, state, nonce,
    };
    if (q.lti_message_hint) params.lti_message_hint = q.lti_message_hint;
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    return u.toString();
  }

  /** Validate the launch id_token and return the client redirect (token + session in the hash). */
  async launch(form: { id_token?: string; state?: string }): Promise<{ redirect: string; sessionId: string; playerId: string; host: boolean }> {
    if (!form.id_token || !form.state) throw new Error("missing id_token/state");
    const st = this.states.get(form.state);
    this.states.delete(form.state);
    if (!st || st.exp < this.now()) throw new Error("invalid state");
    const getKey = this.deps.getKey ?? createRemoteJWKSet(new URL(this.cfg.jwksUrl));
    const { payload } = await jwtVerify(form.id_token, getKey, { issuer: this.cfg.issuer, audience: this.cfg.clientId, algorithms: ["RS256"] });
    if (payload.nonce !== st.nonce) throw new Error("nonce mismatch");
    if (payload[CLAIM.messageType] !== "LtiResourceLinkRequest") throw new Error("unsupported message type");
    if (payload[CLAIM.deployment] !== this.cfg.deploymentId) throw new Error("unknown deployment");
    const sub = typeof payload.sub === "string" ? payload.sub : "";
    if (!sub) throw new Error("missing sub");
    // Only structural claims are read below; profile claims (name, email, ...) are ignored by construction.
    const ctx = (payload[CLAIM.context] as { id?: string } | undefined) ?? {};
    const rl = (payload[CLAIM.resourceLink] as { id?: string } | undefined) ?? {};
    const ags = (payload[CLAIM.ags] as { lineitem?: string } | undefined) ?? {};
    const roles = Array.isArray(payload[CLAIM.roles]) ? (payload[CLAIM.roles] as string[]) : [];
    const host = roles.some((r) => /#(Instructor|Administrator|TeachingAssistant)$/.test(r) || /Administrator$/.test(r));
    const subHash = sha256(`${this.cfg.issuer}|${sub}`);
    const seed = parseInt(subHash.slice(0, 6), 16) % 1_000_000;
    const player = this.db.playerForSub(subHash, seed);
    const sessionId = "lti-" + sha256(`${this.cfg.issuer}|${ctx.id ?? ""}|${rl.id ?? ""}`).slice(0, 16);
    this.db.upsertSession(sessionId, ctx.id ?? null, ags.lineitem ?? null);
    this.db.linkSessionPlayer(sessionId, player.id, sub, host);
    const wsUrl = this.cfg.wsUrl ?? this.cfg.publicUrl.replace(/^http/, "ws");
    const hash = new URLSearchParams({ lti: "1", token: player.token, session: sessionId, ws: wsUrl, host: host ? "1" : "0" });
    return { redirect: `${this.cfg.clientUrl}#${hash.toString()}`, sessionId, playerId: player.id, host };
  }

  /** Host action: push every session player's total to the gradebook via AGS. */
  async wrap(sessionId: string, token: string): Promise<{ pushed: number; skipped: number }> {
    const requester = this.db.playerByToken(token);
    if (!requester || !this.db.isHost(sessionId, requester.id)) throw new Error("not a host of this session");
    const session = this.db.getSession(sessionId);
    if (!session) throw new Error("unknown session");
    if (!session.lineitem_url) throw new Error("session has no gradebook line item (add the tool as a graded activity)");
    const subs = new Map(this.db.sessionPlayers(sessionId).map((p) => [p.playerId, p.sub]));
    const scores = this.db.sessionScores(sessionId);
    const access = await this.accessToken();
    const fetchImpl = this.deps.fetchImpl ?? fetch;
    let pushed = 0, skipped = 0;
    for (const s of scores) {
      const sub = subs.get(s.playerId);
      if (!sub) { skipped++; continue; }
      const body = {
        userId: sub, scoreGiven: s.points, scoreMaximum: Math.max(1, s.maxPoints),
        activityProgress: "Completed", gradingProgress: "FullyGraded", timestamp: new Date(this.now()).toISOString(),
      };
      const res = await fetchImpl(scoresUrl(session.lineitem_url), {
        method: "POST",
        headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/vnd.ims.lis.v1.score+json" },
        body: JSON.stringify(body),
      });
      if (res.ok) pushed++; else skipped++;
    }
    this.db.markWrapped(sessionId, this.now());
    return { pushed, skipped };
  }

  private async accessToken(): Promise<string> {
    const assertion = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: this.kid })
      .setIssuer(this.cfg.clientId).setSubject(this.cfg.clientId).setAudience(this.cfg.tokenUrl)
      .setJti(randomBytes(12).toString("hex")).setIssuedAt().setExpirationTime("5m")
      .sign(this.privateKey);
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: assertion,
      scope: SCOPE_SCORE,
    });
    const fetchImpl = this.deps.fetchImpl ?? fetch;
    const res = await fetchImpl(this.cfg.tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    if (!res.ok) throw new Error(`token endpoint ${res.status}`);
    const json = (await res.json()) as { access_token?: string };
    if (!json.access_token) throw new Error("token endpoint returned no access_token");
    return json.access_token;
  }
}
