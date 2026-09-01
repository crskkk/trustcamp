// src/modules/scorebus/api.ts — the ONLY public door to the scorebus module.
//
// The round-based scoring pipeline's schema + ingest boundary. In v3 every
// minigame result flows through here as a RoundEnvelope; task 0010 lays down
// the envelope shape, its validator, and an in-memory sink so downstream
// scoring / leaderboard / LTI-grade code has a stable contract to build on.
//
// AGENTS §5: envelopes carry only opaque ids. Any recognizable profile claim
// is rejected at the door.

export const ROUND_ENVELOPE_VERSION = 1 as const;

/** One minigame round's scoring summary. All ids are opaque (never PII). */
export interface RoundEnvelope {
  version: typeof ROUND_ENVELOPE_VERSION;
  /** Opaque id for this round instance. */
  roundId: string;
  /** Opaque session id (LTI-derived later; never the `sub` itself, never PII). */
  sessionId: string;
  /** Minigame / event key that produced the score. */
  minigame: string;
  /** Opaque player id. */
  playerId: string;
  /** Role at round end ("scout" | "camper" | …). Free string for now. */
  role: string;
  /** Points earned, `0 … maxPoints`. */
  points: number;
  /** Maximum points the round could award, `> 0`. */
  maxPoints: number;
  /** Epoch ms the round started. */
  startedAt: number;
  /** Epoch ms the round ended, `>= startedAt`. */
  endedAt: number;
}

export type Validation =
  | { ok: true; value: RoundEnvelope }
  | { ok: false; errors: string[] };

/** Profile-claim keys that must never ride along in a scoring envelope. */
const PII_KEYS = [
  "name",
  "email",
  "picture",
  "given_name",
  "givenname",
  "family_name",
  "familyname",
  "middle_name",
  "nickname",
  "preferred_username",
  "displayname",
];

const STRING_FIELDS = ["roundId", "sessionId", "minigame", "playerId", "role"] as const;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Validate an unknown value as a RoundEnvelope. Never throws. */
export function validateEnvelope(input: unknown): Validation {
  const errors: string[] = [];

  if (!isPlainObject(input)) {
    return { ok: false, errors: ["envelope must be a plain object"] };
  }

  const piiHit = Object.keys(input).filter((k) => PII_KEYS.includes(k.toLowerCase()));
  if (piiHit.length > 0) {
    errors.push(`PII claim(s) not allowed in a score envelope: ${piiHit.join(", ")}`);
  }

  if (input.version !== ROUND_ENVELOPE_VERSION) {
    errors.push(`version must be ${ROUND_ENVELOPE_VERSION}`);
  }

  for (const f of STRING_FIELDS) {
    const v = input[f];
    if (typeof v !== "string" || v.trim() === "") {
      errors.push(`${f} must be a non-empty string`);
    }
  }

  const { points, maxPoints, startedAt, endedAt } = input;
  if (!isFiniteNumber(maxPoints) || maxPoints <= 0) {
    errors.push("maxPoints must be a finite number > 0");
  }
  if (!isFiniteNumber(points) || points < 0) {
    errors.push("points must be a finite number >= 0");
  }
  if (isFiniteNumber(points) && isFiniteNumber(maxPoints) && points > maxPoints) {
    errors.push("points must not exceed maxPoints");
  }
  if (!isFiniteNumber(startedAt) || startedAt <= 0) {
    errors.push("startedAt must be a positive epoch-ms number");
  }
  if (!isFiniteNumber(endedAt) || endedAt <= 0) {
    errors.push("endedAt must be a positive epoch-ms number");
  }
  if (isFiniteNumber(startedAt) && isFiniteNumber(endedAt) && endedAt < startedAt) {
    errors.push("endedAt must be >= startedAt");
  }

  if (errors.length > 0) return { ok: false, errors };

  const e = input as unknown as RoundEnvelope;
  return {
    ok: true,
    value: {
      version: ROUND_ENVELOPE_VERSION,
      roundId: e.roundId,
      sessionId: e.sessionId,
      minigame: e.minigame,
      playerId: e.playerId,
      role: e.role,
      points: e.points,
      maxPoints: e.maxPoints,
      startedAt: e.startedAt,
      endedAt: e.endedAt,
    },
  };
}

export interface IngestResult {
  accepted: boolean;
  errors: string[];
}

export interface ScoreSink {
  /** Validate + store an envelope. Invalid input is rejected, not stored. */
  ingest(input: unknown): IngestResult;
  /** Number of accepted envelopes currently buffered. */
  count(): number;
  /** Return all buffered envelopes and clear the buffer. */
  drain(): RoundEnvelope[];
}

export interface SinkOptions {
  /** Called with each accepted envelope — the seam a debug overlay / real
   *  scoring pipeline subscribes to later. */
  onAccept?: (envelope: RoundEnvelope) => void;
}

/** Create an in-memory scoring sink. */
export function createSink(opts: SinkOptions = {}): ScoreSink {
  const buffer: RoundEnvelope[] = [];
  return {
    ingest(input) {
      const res = validateEnvelope(input);
      if (!res.ok) return { accepted: false, errors: res.errors };
      buffer.push(res.value);
      if (typeof console !== "undefined") {
        console.debug("[scorebus] ingest", res.value.roundId, `${res.value.points}/${res.value.maxPoints}`);
      }
      opts.onAccept?.(res.value);
      return { accepted: true, errors: [] };
    },
    count() {
      return buffer.length;
    },
    drain() {
      return buffer.splice(0, buffer.length);
    },
  };
}
