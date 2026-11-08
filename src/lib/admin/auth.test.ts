import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isOwnerAuthConfigured,
  getOwnerAllowlist,
  isOwnerAuthorized,
  createOAuthState,
  verifyOAuthState,
  createAdminSessionToken,
  verifyAdminSessionToken,
  getAdminSessionFromCookie,
  verifyAdminRequest,
  ADMIN_SESSION_COOKIE_NAME,
} from "./auth";

describe("LEMON-048: Owner Authentication & Session Security", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Configuration & Allowlist Check", () => {
    it("reports not configured when any required variable is missing", () => {
      delete process.env.ADMIN_GOOGLE_CLIENT_ID;
      delete process.env.ADMIN_GOOGLE_CLIENT_SECRET;
      delete process.env.ADMIN_SESSION_SECRET;
      delete process.env.ADMIN_OWNER_EMAILS;

      expect(isOwnerAuthConfigured()).toBe(false);
    });

    it("reports configured when all 4 required variables are present", () => {
      process.env.ADMIN_GOOGLE_CLIENT_ID = "client-id.apps.googleusercontent.com";
      process.env.ADMIN_GOOGLE_CLIENT_SECRET = "client-secret-123";
      process.env.ADMIN_SESSION_SECRET = "super-secret-key-32-bytes-long-min!";
      process.env.ADMIN_OWNER_EMAILS = "owner@example.com, coowner@example.com";

      expect(isOwnerAuthConfigured()).toBe(true);
      expect(getOwnerAllowlist()).toEqual(["owner@example.com", "coowner@example.com"]);
    });

    it("verifies owner authorization case-insensitively", () => {
      process.env.ADMIN_OWNER_EMAILS = "Owner@Example.Com";

      expect(isOwnerAuthorized("owner@example.com")).toBe(true);
      expect(isOwnerAuthorized("OWNER@EXAMPLE.COM")).toBe(true);
      expect(isOwnerAuthorized("stranger@example.com")).toBe(false);
    });

    it("supports optional Google Sub ID verification when configured", () => {
      process.env.ADMIN_OWNER_EMAILS = "owner@example.com";
      process.env.ADMIN_GOOGLE_IDS = "112233445566778899";

      expect(isOwnerAuthorized("owner@example.com", "112233445566778899")).toBe(true);
      expect(isOwnerAuthorized("owner@example.com", "wrong-sub-id")).toBe(false);
    });
  });

  describe("OAuth State CSRF Protection", () => {
    beforeEach(() => {
      process.env.ADMIN_SESSION_SECRET = "test-session-secret-key-123456789";
    });

    it("creates and verifies valid OAuth state", () => {
      const { state, cookieValue } = createOAuthState();
      expect(state).toBeTruthy();
      expect(cookieValue).toBe(state);

      const isValid = verifyOAuthState(state, cookieValue);
      expect(isValid).toBe(true);
    });

    it("rejects mismatched state and cookie", () => {
      const { state } = createOAuthState();
      expect(verifyOAuthState(state, "tampered-state")).toBe(false);
      expect(verifyOAuthState("tampered-state", state)).toBe(false);
    });

    it("rejects state with tampered signature", () => {
      const { state, cookieValue } = createOAuthState();
      const tampered = state.slice(0, -4) + "XXXX";
      expect(verifyOAuthState(tampered, cookieValue)).toBe(false);
    });
  });

  describe("Signed Admin Session Tokens", () => {
    beforeEach(() => {
      process.env.ADMIN_SESSION_SECRET = "test-session-secret-key-123456789";
      process.env.ADMIN_OWNER_EMAILS = "owner@example.com";
    });

    it("creates and verifies valid session token", () => {
      const token = createAdminSessionToken({
        email: "owner@example.com",
        sub: "google-sub-12345",
        name: "Lemon Owner",
      });

      const session = verifyAdminSessionToken(token);
      expect(session).not.toBeNull();
      expect(session?.email).toBe("owner@example.com");
      expect(session?.sub).toBe("google-sub-12345");
      expect(session?.name).toBe("Lemon Owner");
    });

    it("rejects session if email is not on owner allowlist", () => {
      const token = createAdminSessionToken({
        email: "unauthorized@example.com",
        sub: "google-sub-99999",
      });

      // Verification must fail because email is not in ADMIN_OWNER_EMAILS
      const session = verifyAdminSessionToken(token);
      expect(session).toBeNull();
    });

    it("rejects token with invalid signature", () => {
      const token = createAdminSessionToken({
        email: "owner@example.com",
        sub: "google-sub-12345",
      });
      const tampered = token.slice(0, -5) + "abcde";
      expect(verifyAdminSessionToken(tampered)).toBeNull();
    });

    it("extracts session from Cookie header", () => {
      const token = createAdminSessionToken({
        email: "owner@example.com",
        sub: "google-sub-12345",
      });

      const cookieHeader = `other_cookie=value; ${ADMIN_SESSION_COOKIE_NAME}=${token}; theme=light`;
      const session = getAdminSessionFromCookie(cookieHeader);
      expect(session).not.toBeNull();
      expect(session?.email).toBe("owner@example.com");
    });
  });

  describe("API Request Verification", () => {
    it("returns 503 if owner auth is not configured", () => {
      delete process.env.ADMIN_GOOGLE_CLIENT_ID;
      const req = new Request("https://lemon.test/api/admin/metrics");
      const result = verifyAdminRequest(req);

      expect(result.session).toBeNull();
      expect(result.errorResponse?.status).toBe(503);
    });

    it("returns 401 if request has no valid session cookie", () => {
      process.env.ADMIN_GOOGLE_CLIENT_ID = "id";
      process.env.ADMIN_GOOGLE_CLIENT_SECRET = "secret";
      process.env.ADMIN_SESSION_SECRET = "secret32bytesminimum123456789012";
      process.env.ADMIN_OWNER_EMAILS = "owner@example.com";

      const req = new Request("https://lemon.test/api/admin/metrics");
      const result = verifyAdminRequest(req);

      expect(result.session).toBeNull();
      expect(result.errorResponse?.status).toBe(401);
    });

    it("returns verified session when valid cookie is present", () => {
      process.env.ADMIN_GOOGLE_CLIENT_ID = "id";
      process.env.ADMIN_GOOGLE_CLIENT_SECRET = "secret";
      process.env.ADMIN_SESSION_SECRET = "secret32bytesminimum123456789012";
      process.env.ADMIN_OWNER_EMAILS = "owner@example.com";

      const token = createAdminSessionToken({
        email: "owner@example.com",
        sub: "google-123",
      });

      const req = new Request("https://lemon.test/api/admin/metrics", {
        headers: {
          cookie: `${ADMIN_SESSION_COOKIE_NAME}=${token}`,
        },
      });

      const result = verifyAdminRequest(req);
      expect(result.errorResponse).toBeNull();
      expect(result.session?.email).toBe("owner@example.com");
    });
  });
});
