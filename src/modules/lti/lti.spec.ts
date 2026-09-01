import { describe, it, expect, vi } from "vitest";
import { handleLaunch, validateClaims, type LtiLaunchArgs } from "./api";
import { createFixtureToken } from "./__fixtures__/jwt";

describe("lti scaffold (Phase C)", () => {
  describe("validateClaims (privacy filter)", () => {
    it("returns true for valid payload with sub claim only", () => {
      const payload = { sub: "opaque-user-key-12345" };
      expect(validateClaims(payload)).toBe(true);
    });

    it("rejects payload with name claim (PII)", () => {
      const payload = { sub: "opaque-user-key-12345", name: "John Doe" };
      expect(validateClaims(payload)).toBe(false);
    });

    it("rejects payload with email claim (PII)", () => {
      const payload = { sub: "opaque-user-key-12345", email: "john@example.com" };
      expect(validateClaims(payload)).toBe(false);
    });

    it("rejects payload with picture claim (PII)", () => {
      const payload = {
        sub: "opaque-user-key-12345",
        picture: "https://example.com/avatar.png",
      };
      expect(validateClaims(payload)).toBe(false);
    });

    it("rejects null or undefined payload", () => {
      expect(validateClaims(null)).toBe(false);
      expect(validateClaims(undefined)).toBe(false);
    });

    it("rejects payload without sub claim", () => {
      expect(validateClaims({ name: "test" })).toBe(false);
    });
  });

  describe("handleLaunch", () => {
    it("validates fixture-signed JWT and returns opaque session token", async () => {
      const fixtureToken = createFixtureToken({ sub: "user-12345" });
      const args: LtiLaunchArgs = { id_token: fixtureToken };
      
      const result = await handleLaunch(args);
      expect(result).toMatch(/^sess-[a-z0-9]{12}$/);
    });

    it("rejects malformed JWT", async () => {
      const args: LtiLaunchArgs = { id_token: "not-a-valid-jwt" };
      await expect(handleLaunch(args)).rejects.toThrow("Invalid JWT");
    });

    it("rejects JWT with PII claims (name)", async () => {
      const fixtureToken = createFixtureToken({ sub: "user-12345", name: "John Doe" });
      const args: LtiLaunchArgs = { id_token: fixtureToken };
      
      await expect(handleLaunch(args)).rejects.toThrow("PII claims detected");
    });

    it("rejects JWT with PII claims (email)", async () => {
      const fixtureToken = createFixtureToken({ sub: "user-12345", email: "test@example.com" });
      const args: LtiLaunchArgs = { id_token: fixtureToken };
      
      await expect(handleLaunch(args)).rejects.toThrow("PII claims detected");
    });

    it("logs launch-ok with sub key to console (visual checkpoint)", async () => {
      const fixtureToken = createFixtureToken({ sub: "user-abc-123" });
      const args: LtiLaunchArgs = { id_token: fixtureToken };

      const consoleSpy = vi.spyOn(console, "log");
      await handleLaunch(args);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/launch-ok.*sub=user-abc-123/)
      );

      consoleSpy.mockRestore();
    });

    it("rejects token with missing id_token", async () => {
      const args = { id_token: "" } as LtiLaunchArgs;
      await expect(handleLaunch(args)).rejects.toThrow("Invalid or missing");
    });
  });
});