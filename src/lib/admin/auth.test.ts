import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isOwnerAuthConfigured,
  getOwnerAllowlist,
  getOwnerSubAllowlist,
  isOwnerAuthorized,
  createOAuthState,
  verifyOAuthState,
  createAdminSessionToken,
  verifyAdminSessionToken,
  getAdminSessionFromCookie,
  verifyAdminRequest,
  getTrustedRedirectOrigin,
  verifyGoogleIdToken,
  ADMIN_SESSION_COOKIE_NAME,
} from "./auth";
import type { OAuth2Client } from "google-auth-library";

describe("LEMON-048A: Secure Owner Auth & Identity Verification", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
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

    it("strictly binds owner authorization to allowlisted Google subject (sub)", () => {
      process.env.ADMIN_OWNER_EMAILS = "owner@example.com";
      process.env.ADMIN_OWNER_SUBS = "109876543210987654321, 209876543210987654321";

      expect(getOwnerSubAllowlist()).toEqual(["109876543210987654321", "209876543210987654321"]);

      // Matching email AND matching sub -> authorized
      expect(isOwnerAuthorized("owner@example.com", "109876543210987654321")).toBe(true);
      expect(isOwnerAuthorized("owner@example.com", "209876543210987654321")).toBe(true);

      // Matching email BUT wrong sub -> REJECTED
      expect(isOwnerAuthorized("owner@example.com", "wrong-attacker-sub")).toBe(false);

      // Matching email BUT missing sub -> REJECTED
      expect(isOwnerAuthorized("owner@example.com", undefined)).toBe(false);
      expect(isOwnerAuthorized("owner@example.com", "")).toBe(false);

      // Wrong email even with matching sub -> REJECTED
      expect(isOwnerAuthorized("impostor@example.com", "109876543210987654321")).toBe(false);
    });
  });

  describe("Fixed Configured Redirect Origin", () => {
    it("uses ADMIN_ALLOWED_ORIGIN when explicitly configured", () => {
      process.env.ADMIN_ALLOWED_ORIGIN = "https://custom.admin.lemon.sa/";
      expect(getTrustedRedirectOrigin()).toBe("https://custom.admin.lemon.sa");
    });

    it("uses production URL or fixed Netlify domain in production mode", () => {
      delete process.env.ADMIN_ALLOWED_ORIGIN;
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      process.env.URL = "https://yourcampuspallemon.netlify.app";

      expect(getTrustedRedirectOrigin()).toBe("https://yourcampuspallemon.netlify.app");
    });

    it("falls back to localhost:3000 in local development", () => {
      delete process.env.ADMIN_ALLOWED_ORIGIN;
      (process.env as Record<string, string | undefined>).NODE_ENV = "development";
      delete process.env.URL;

      expect(getTrustedRedirectOrigin()).toBe("http://localhost:3000");
    });
  });

  describe("Cryptographic ID Token Verification (verifyGoogleIdToken)", () => {
    it("successfully validates signed ID token claims via google-auth-library", async () => {
      const mockPayload = {
        iss: "https://accounts.google.com",
        aud: "my-client-id",
        sub: "google-sub-12345",
        email: "owner@example.com",
        email_verified: true,
        name: "Lemon Admin",
        picture: "https://example.com/avatar.png",
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const mockClient = {
        verifyIdToken: vi.fn().mockResolvedValue({
          getPayload: () => mockPayload,
        }),
      } as unknown as OAuth2Client;

      const identity = await verifyGoogleIdToken("valid-id-token", "my-client-id", mockClient);

      expect(mockClient.verifyIdToken).toHaveBeenCalledWith({
        idToken: "valid-id-token",
        audience: "my-client-id",
      });
      expect(identity.email).toBe("owner@example.com");
      expect(identity.sub).toBe("google-sub-12345");
      expect(identity.name).toBe("Lemon Admin");
      expect(identity.emailVerified).toBe(true);
    });

    it("rejects ID tokens with unverified email addresses", async () => {
      const mockPayload = {
        iss: "https://accounts.google.com",
        aud: "my-client-id",
        sub: "google-sub-12345",
        email: "unverified@example.com",
        email_verified: false,
      };

      const mockClient = {
        verifyIdToken: vi.fn().mockResolvedValue({
          getPayload: () => mockPayload,
        }),
      } as unknown as OAuth2Client;

      await expect(verifyGoogleIdToken("unverified-token", "my-client-id", mockClient)).rejects.toThrow(
        "Google email is not verified",
      );
    });

    it("rejects ID tokens when google-auth-library throws signature mismatch or expired token", async () => {
      const mockClient = {
        verifyIdToken: vi.fn().mockRejectedValue(new Error("Invalid token signature")),
      } as unknown as OAuth2Client;

      await expect(verifyGoogleIdToken("forged-token", "my-client-id", mockClient)).rejects.toThrow(
        "Invalid token signature",
      );
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
      process.env.ADMIN_OWNER_SUBS = "google-sub-12345";
    });

    it("creates and verifies valid session token with email and sub matching allowlist", () => {
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

    it("rejects session if sub does not match allowlist", () => {
      const token = createAdminSessionToken({
        email: "owner@example.com",
        sub: "unauthorized-sub-99999",
      });

      const session = verifyAdminSessionToken(token);
      expect(session).toBeNull();
    });

    it("rejects session if email is not on owner allowlist", () => {
      const token = createAdminSessionToken({
        email: "unauthorized@example.com",
        sub: "google-sub-12345",
      });

      const session = verifyAdminSessionToken(token);
      expect(session).toBeNull();
    });

    it("rejects token with invalid signature or session tampering", () => {
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
