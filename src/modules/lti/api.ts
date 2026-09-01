// src/modules/lti/api.ts — the ONLY public door to the LTI module.
//
// LTI 1.3 Phase C scaffold: OIDC login handler, JWT validation,
// session token emit with privacy-first design.
//
// Only the opaque 'sub' claim is used; no PII is ever requested.
// Scopes: lineitem, result, membership (minimum required).

import { verifyFixtureToken, hasPiIClaims } from "./__fixtures__/jwt";

export interface LtiLaunchArgs {
  /** The JWT ID token from the LTI platform (OIDC login flow). */
  id_token: string;
}

export type SessionToken = string;

/**
 * Validate that the payload contains only allowed claims (sub only).
 * Returns true if the payload is safe, false if it contains PII.
 */
export function validateClaims(payload: unknown): boolean {
  // Reject null / undefined
  if (!payload || typeof payload !== "object") return false;
  
  // Reject if PII claims are present
  if (hasPiIClaims(payload)) return false;
  
  // Must have sub claim
  const obj = payload as Record<string, unknown>;
  if (!obj.sub || typeof obj.sub !== "string") return false;
  
  return true;
}

/**
 * Handle an LTI launch. Validates the JWT, checks privacy claims,
 * and returns an opaque session token.
 * 
 * @param args - The LTI launch arguments containing the ID token
 * @returns An opaque session token for the user
 * @throws If the JWT is invalid or contains PII claims
 */
export async function handleLaunch(args: LtiLaunchArgs): Promise<SessionToken> {
  const { id_token } = args;
  
  if (!id_token || typeof id_token !== "string") {
    throw new Error("Invalid or missing id_token");
  }
  
  // Verify the JWT and extract payload
  const payload = verifyFixtureToken(id_token);
  
  if (!payload) {
    throw new Error("Invalid JWT signature or structure");
  }
  
  // Check for PII claims (privacy rule)
  if (!validateClaims(payload)) {
    throw new Error("LTI launch rejected: PII claims detected");
  }
  
  // Generate opaque session token
  const sessionId = generateSessionToken();
  
  // Debug console overlay: log launch-ok with sub key
  console.log(`launch-ok: sub=${payload.sub}`);
  
  // In production, this would:
  // 1. Store the session in the database
  // 2. Map the sub to an internal user ID
  // 3. Set up the LTI context (roles, lineitems, etc.)
  
  return sessionId;
}

/**
 * Push a grade for a user via LTI Assignment and Grade Services.
 * This would be called on "wrap session" in production.
 */
export async function pushGrade(
  sessionId: string,
  score: number
): Promise<void> {
  // Stub: would call LTI AGS endpoint with the session's lineitem
  console.log("[LTI] would push grade", score, "for session", sessionId);
}

/**
 * Get group/team membership via LTI Names and Role Provisioning Service.
 */
export async function getGroups(sessionId: string): Promise<string[]> {
  // Stub: would call LTI NRPS endpoint
  console.log("[LTI] would get groups for session", sessionId);
  return [];
}

/**
 * Generate an opaque session token.
 */
function generateSessionToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "sess-";
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}