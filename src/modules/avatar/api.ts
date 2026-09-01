// src/modules/avatar/api.ts — the ONLY public door to the avatar module.
// Other modules import { generate, AvatarSpec, toJSON, fromJSON } from "../avatar/api".

export interface AvatarSpec {
  skinTone: 0 | 1 | 2 | 3 | 4;
  hairStyle: 0 | 1 | 2 | 3 | 4;
  hairColor: 0 | 1 | 2 | 3 | 4;
  eyeColor: 0 | 1 | 2 | 3 | 4;
  expression: 0 | 1 | 2 | 3;
  bodyAccent: 0 | 1 | 2 | 3;
  version: 1;
}

/** Seeded PRNG: linear congruential generator for deterministic randomness. */
function createSeededRNG(seed: number) {
  // Using standard LCG parameters: similar to glibc
  const a = 1103515245;
  const c = 12345;
  const m = 2147483648; // 2^31
  let current = seed % m;

  return {
    next(): number {
      current = (a * current + c) % m;
      return current / m; // Returns [0, 1)
    },
  };
}

/**
 * Generate an AvatarSpec deterministically from a seed.
 * Same seed always produces the same spec (bit-identical).
 */
export function generate(seed: number): AvatarSpec {
  const rng = createSeededRNG(seed);

  return {
    skinTone: (Math.floor(rng.next() * 5) % 5) as AvatarSpec["skinTone"],
    hairStyle: (Math.floor(rng.next() * 5) % 5) as AvatarSpec["hairStyle"],
    hairColor: (Math.floor(rng.next() * 5) % 5) as AvatarSpec["hairColor"],
    eyeColor: (Math.floor(rng.next() * 5) % 5) as AvatarSpec["eyeColor"],
    expression: (Math.floor(rng.next() * 4) % 4) as AvatarSpec["expression"],
    bodyAccent: (Math.floor(rng.next() * 4) % 4) as AvatarSpec["bodyAccent"],
    version: 1,
  };
}

/** Serialize an AvatarSpec to JSON string. */
export function toJSON(spec: AvatarSpec): string {
  return JSON.stringify(spec);
}

/** Deserialize an AvatarSpec from JSON string. */
export function fromJSON(json: string): AvatarSpec {
  const parsed = JSON.parse(json);

  // Validate the parsed object matches AvatarSpec shape
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof parsed.skinTone !== "number" ||
    typeof parsed.hairStyle !== "number" ||
    typeof parsed.hairColor !== "number" ||
    typeof parsed.eyeColor !== "number" ||
    typeof parsed.expression !== "number" ||
    typeof parsed.bodyAccent !== "number" ||
    parsed.version !== 1
  ) {
    throw new Error("Invalid AvatarSpec JSON");
  }

  return parsed as AvatarSpec;
}

export type { AvatarSpec as _AvatarSpec };
