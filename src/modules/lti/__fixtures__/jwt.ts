// Test fixture utilities for JWT generation and verification
// Used for LTI Phase C scaffold testing

import crypto from "crypto";

// Deterministic secret for test fixtures (NOT for production!)
const FIXTURE_SECRET = "fixture-secret-dont-use-in-production";

export interface FixtureTokenPayload {
  sub: string;
  iss?: string;
  aud?: string;
  [key: string]: unknown;
}

/**
 * Create a fixture JWT-like token with the given payload.
 * Uses HMAC-SHA256 (HS256) signing with a test secret.
 */
export function createFixtureToken(payload: FixtureTokenPayload): string {
  const header = {
    alg: "HS256",
    typ: "JWT",
    kid: "fixture-key",
  };

  const fullPayload = {
    ...payload,
    iat: 1700000000,
    exp: 1800000000,
  };

  const headerB64 = base64urlEncode(JSON.stringify(header));
  const payloadB64 = base64urlEncode(JSON.stringify(fullPayload));
  const signature = sign(`${headerB64}.${payloadB64}`, FIXTURE_SECRET);

  return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * Verify a fixture token and extract the payload.
 * Returns null if verification fails or payload is invalid.
 */
export function verifyFixtureToken(token: string): FixtureTokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    // Verify signature
    const expectedSignature = sign(`${headerB64}.${payloadB64}`, FIXTURE_SECRET);
    if (signatureB64 !== expectedSignature) return null;

    // Decode payload
    const payload = JSON.parse(base64urlDecode(payloadB64));

    if (!payload.sub) return null;

    return payload as FixtureTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Check if a payload has PII claims (name, email, picture, etc.)
 * Returns true if PII is present (should be rejected), false if safe.
 */
export function hasPiIClaims(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  
  const obj = payload as Record<string, unknown>;
  const piiKeys = ["name", "email", "picture", "given_name", "family_name", "middle_name", "nickname", "preferred_username"];
  
  return piiKeys.some((key) => key in obj);
}

function base64urlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlDecode(str: string): string {
  // Add padding if needed
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

function sign(data: string, secret: string): string {
  const sig = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest();
  return sig
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}