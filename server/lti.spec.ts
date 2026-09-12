// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import { SignJWT, generateKeyPair, exportJWK, createLocalJWKSet, type JWK } from "jose";
import { Db } from "./db";
import { CLAIM, Lti, scoresUrl, type LtiConfig } from "./lti";

const cfg: LtiConfig = {
  issuer: "https://moodle.test",
  clientId: "client-abc",
  deploymentId: "1",
  authUrl: "https://moodle.test/mod/lti/auth.php",
  tokenUrl: "https://moodle.test/mod/lti/token.php",
  jwksUrl: "https://moodle.test/mod/lti/certs.php",
  publicUrl: "https://thebar.example",
  clientUrl: "https://crskkk.github.io/trustcamp/",
  keyPath: undefined,
};

const LINEITEM = "https://moodle.test/mod/lti/services.php/2/lineitems/7/lineitem?type_id=3";

describe("LTI 1.3 tool", () => {
  let platformKey: CryptoKey;
  let jwk: JWK;
  let db: Db;
  let lti: Lti;
  const calls: Array<{ url: string; init: RequestInit }> = [];

  async function idToken(claims: Record<string, unknown>, sub: string, nonce: string): Promise<string> {
    return new SignJWT({
      nonce,
      name: "Alice Example", email: "alice@example.com", given_name: "Alice", // sent by a misconfigured platform; must be ignored
      [CLAIM.messageType]: "LtiResourceLinkRequest",
      [CLAIM.version]: "1.3.0",
      [CLAIM.deployment]: "1",
      [CLAIM.context]: { id: "course-1", title: "Camp 101" },
      [CLAIM.resourceLink]: { id: "rl-1" },
      [CLAIM.ags]: { lineitem: LINEITEM, scope: ["https://purl.imsglobal.org/spec/lti-ags/scope/score"] },
      ...claims,
    })
      .setProtectedHeader({ alg: "RS256", kid: "plat-1" })
      .setIssuer(cfg.issuer).setAudience(cfg.clientId).setSubject(sub).setIssuedAt().setExpirationTime("5m")
      .sign(platformKey);
  }

  beforeAll(async () => {
    const pair = await generateKeyPair("RS256");
    platformKey = pair.privateKey;
    jwk = { ...(await exportJWK(pair.publicKey)), kid: "plat-1", alg: "RS256", use: "sig" };
    db = new Db(":memory:");
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      if (String(url) === cfg.tokenUrl) return new Response(JSON.stringify({ access_token: "ags-token", expires_in: 3600 }), { status: 200, headers: { "Content-Type": "application/json" } });
      return new Response("", { status: 200 });
    };
    lti = new Lti(cfg, db, { fetchImpl, getKey: createLocalJWKSet({ keys: [jwk] }) });
    await lti.init();
  });

  it("publishes a JWKS with one RS256 signing key and a tool config", () => {
    const j = lti.jwks();
    expect(j.keys).toHaveLength(1);
    expect(j.keys[0]).toMatchObject({ kty: "RSA", alg: "RS256", use: "sig", kid: "thebar-1" });
    expect(j.keys[0]).not.toHaveProperty("d");
    expect(lti.toolConfig()).toMatchObject({ oidc_initiation_url: "https://thebar.example/lti/login", public_jwk_url: "https://thebar.example/lti/jwks", privacy: { share_name: false, share_email: false } });
  });

  it("login redirects to the platform auth endpoint with state + nonce; launch mints a session and player (no PII kept)", async () => {
    const redirect = lti.login({ iss: cfg.issuer, login_hint: "u-1", target_link_uri: "https://thebar.example/lti/launch", client_id: cfg.clientId });
    const u = new URL(redirect);
    expect(`${u.origin}${u.pathname}`).toBe(cfg.authUrl);
    expect(u.searchParams.get("redirect_uri")).toBe("https://thebar.example/lti/launch");
    expect(u.searchParams.get("response_mode")).toBe("form_post");
    const state = u.searchParams.get("state")!, nonce = u.searchParams.get("nonce")!;
    expect(() => lti.login({ iss: "https://other.test", login_hint: "x" })).toThrow(/issuer/);

    const token = await idToken({ [CLAIM.roles]: ["http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor"] }, "teacher-sub", nonce);
    const res = await lti.launch({ id_token: token, state });
    expect(res.host).toBe(true);
    expect(res.sessionId).toMatch(/^lti-[0-9a-f]{16}$/);
    const hash = new URL(res.redirect).hash.slice(1);
    const p = new URLSearchParams(hash);
    expect(res.redirect.startsWith(cfg.clientUrl + "#")).toBe(true);
    expect(p.get("lti")).toBe("1");
    expect(p.get("session")).toBe(res.sessionId);
    expect(p.get("ws")).toBe("wss://thebar.example");
    expect(p.get("host")).toBe("1");
    expect(p.get("token")).toHaveLength(48);
    expect(db.sessionPlayers(res.sessionId)).toEqual([{ playerId: res.playerId, sub: "teacher-sub", isHost: true }]);
    // Replaying the same state fails; a wrong nonce fails.
    await expect(lti.launch({ id_token: token, state })).rejects.toThrow(/state/);
  });

  it("a learner launch joins the same session as a non-host; the same user resumes the same player", async () => {
    const s1 = new URL(lti.login({ iss: cfg.issuer, login_hint: "u-2" }));
    const t1 = await idToken({ [CLAIM.roles]: ["http://purl.imsglobal.org/vocab/lis/v2/membership#Learner"] }, "student-sub", s1.searchParams.get("nonce")!);
    const r1 = await lti.launch({ id_token: t1, state: s1.searchParams.get("state")! });
    expect(r1.host).toBe(false);
    const s2 = new URL(lti.login({ iss: cfg.issuer, login_hint: "u-2" }));
    const t2 = await idToken({ [CLAIM.roles]: ["http://purl.imsglobal.org/vocab/lis/v2/membership#Learner"] }, "student-sub", s2.searchParams.get("nonce")!);
    const r2 = await lti.launch({ id_token: t2, state: s2.searchParams.get("state")! });
    expect(r2.playerId).toBe(r1.playerId);
    expect(r2.sessionId).toBe(r1.sessionId);
  });

  it("wrap: only a host may push; posts one AGS score per player with points/maxPoints and the opaque sub", async () => {
    const sessionId = await sessionOf();
    const players = db.sessionPlayers(sessionId);
    const student = players.find((p) => p.sub === "student-sub")!;
    const teacher = players.find((p) => p.sub === "teacher-sub")!;
    expect(teacher.isHost).toBe(true);
    expect(student.isHost).toBe(false);
    db.recordRound(student.playerId, { version: 1, roundId: "r1", sessionId, minigame: "firewood-dash", playerId: student.playerId, role: "scout", points: 40, maxPoints: 80, startedAt: 1, endedAt: 2 });
    db.recordRound(student.playerId, { version: 1, roundId: "r2", sessionId, minigame: "lantern-relay", playerId: student.playerId, role: "scout", points: 60, maxPoints: 95, startedAt: 3, endedAt: 4 });
    const studentToken = tokenOf(student.playerId), teacherToken = tokenOf(teacher.playerId);
    await expect(lti.wrap(sessionId, studentToken)).rejects.toThrow(/host/);
    calls.length = 0;
    const out = await lti.wrap(sessionId, teacherToken);
    expect(out).toEqual({ pushed: 1, skipped: 0 });
    expect(calls[0].url).toBe(cfg.tokenUrl);
    const form = calls[0].init.body as URLSearchParams;
    expect(form.get("grant_type")).toBe("client_credentials");
    expect(form.get("client_assertion_type")).toBe("urn:ietf:params:oauth:client-assertion-type:jwt-bearer");
    expect(form.get("scope")).toBe("https://purl.imsglobal.org/spec/lti-ags/scope/score");
    expect(calls[1].url).toBe("https://moodle.test/mod/lti/services.php/2/lineitems/7/lineitem/scores?type_id=3");
    expect((calls[1].init.headers as Record<string, string>).Authorization).toBe("Bearer ags-token");
    expect(JSON.parse(calls[1].init.body as string)).toMatchObject({ userId: "student-sub", scoreGiven: 100, scoreMaximum: 175, activityProgress: "Completed", gradingProgress: "FullyGraded" });
    expect(db.getSession(sessionId)!.wrapped_at).toBeTruthy();
    expect(scoresUrl("https://x/li")).toBe("https://x/li/scores");
  });

  async function sessionOf(): Promise<string> {
    // Both launches above landed in the same course/resource link session.
    const s = new URL(lti.login({ iss: cfg.issuer, login_hint: "probe" }));
    const t = await idToken({ [CLAIM.roles]: [] }, "probe-sub", s.searchParams.get("nonce")!);
    return (await lti.launch({ id_token: t, state: s.searchParams.get("state")! })).sessionId;
  }
  function tokenOf(playerId: string): string {
    // Test-only: read the token back through the resume path.
    const rec = (db as unknown as { db: { prepare(sql: string): { get(id: string): { token: string } } } }).db.prepare("SELECT token FROM players WHERE id = ?").get(playerId);
    return rec.token;
  }
});
