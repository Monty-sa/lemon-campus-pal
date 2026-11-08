import crypto from "node:crypto";
import { NextResponse } from "next/server";

export interface AdminSessionPayload {
  email: string;
  sub: string;
  name?: string;
  picture?: string;
  iat: number;
  exp: number;
}

export const ADMIN_SESSION_COOKIE_NAME = "lemon_admin_session";
export const ADMIN_STATE_COOKIE_NAME = "lemon_admin_state";
export const SESSION_TTL_SECONDS = 86400; // 24 hours
export const STATE_TTL_SECONDS = 600; // 10 minutes

/**
 * Checks if the required owner OAuth and session configuration is present.
 */
export function isOwnerAuthConfigured(): boolean {
  const clientId = process.env.ADMIN_GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.ADMIN_GOOGLE_CLIENT_SECRET?.trim();
  const sessionSecret = process.env.ADMIN_SESSION_SECRET?.trim();
  const ownerEmails = process.env.ADMIN_OWNER_EMAILS?.trim();

  return Boolean(clientId && clientSecret && sessionSecret && ownerEmails);
}

/**
 * Returns the normalized list of allowed owner emails.
 */
export function getOwnerAllowlist(): string[] {
  const raw = process.env.ADMIN_OWNER_EMAILS?.trim() || "";
  if (!raw) return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Returns the optional list of allowed Google Sub IDs for stable identity enforcement.
 */
export function getOwnerSubAllowlist(): string[] {
  const raw = process.env.ADMIN_GOOGLE_IDS?.trim() || "";
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Verifies if an email and optional sub ID belong to the authorized owner allowlist.
 */
export function isOwnerAuthorized(email: string, sub?: string): boolean {
  const allowlist = getOwnerAllowlist();
  if (!allowlist.length) return false;

  const normalizedEmail = email.trim().toLowerCase();
  const emailAllowed = allowlist.includes(normalizedEmail);
  if (!emailAllowed) return false;

  const subAllowlist = getOwnerSubAllowlist();
  if (subAllowlist.length > 0 && sub) {
    return subAllowlist.includes(sub);
  }

  return true;
}

function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not configured");
  }
  return secret;
}

/**
 * Signs data using HMAC-SHA256.
 */
function signData(data: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

/**
 * Creates a signed OAuth state token to protect against CSRF attacks.
 */
export function createOAuthState(): { state: string; cookieValue: string } {
  const secret = getSessionSecret();
  const randomBytes = crypto.randomBytes(24).toString("base64url");
  const expiresAt = Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS;
  const raw = `${randomBytes}:${expiresAt}`;
  const sig = signData(raw, secret);
  const state = `${raw}.${sig}`;
  return { state, cookieValue: state };
}

/**
 * Verifies that the returned OAuth state is valid, correctly signed, and not expired.
 */
export function verifyOAuthState(state: string | null | undefined, cookieState: string | null | undefined): boolean {
  if (!state || !cookieState || state !== cookieState) return false;

  try {
    const secret = getSessionSecret();
    const lastDot = state.lastIndexOf(".");
    if (lastDot === -1) return false;

    const raw = state.slice(0, lastDot);
    const signature = state.slice(lastDot + 1);

    const expectedSig = signData(raw, secret);
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return false;
    }

    const [, expiresAtStr] = raw.split(":");
    const expiresAt = parseInt(expiresAtStr, 10);
    const now = Math.floor(Date.now() / 1000);

    return now <= expiresAt;
  } catch {
    return false;
  }
}

/**
 * Creates an HMAC-signed session token for the authenticated owner.
 */
export function createAdminSessionToken(payload: Omit<AdminSessionPayload, "iat" | "exp">): string {
  const secret = getSessionSecret();
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: AdminSessionPayload = {
    ...payload,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };

  const serialized = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const sig = signData(serialized, secret);
  return `${serialized}.${sig}`;
}

/**
 * Validates and decodes an admin session token.
 */
export function verifyAdminSessionToken(token: string | null | undefined): AdminSessionPayload | null {
  if (!token) return null;

  try {
    const secret = getSessionSecret();
    const lastDot = token.lastIndexOf(".");
    if (lastDot === -1) return null;

    const raw = token.slice(0, lastDot);
    const signature = token.slice(lastDot + 1);

    const expectedSig = signData(raw, secret);
    if (signature.length !== expectedSig.length) return null;

    const valid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
    if (!valid) return null;

    const decodedStr = Buffer.from(raw, "base64url").toString("utf8");
    const payload = JSON.parse(decodedStr) as AdminSessionPayload;

    const now = Math.floor(Date.now() / 1000);
    if (now > payload.exp) {
      return null; // Expired
    }

    // Always re-validate against current owner allowlist
    if (!isOwnerAuthorized(payload.email, payload.sub)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Extracts and verifies the admin session from a Cookie header string.
 */
export function getAdminSessionFromCookie(cookieHeader: string | null | undefined): AdminSessionPayload | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const prefix = `${ADMIN_SESSION_COOKIE_NAME}=`;
  const sessionCookie = cookies.find((c) => c.startsWith(prefix));
  if (!sessionCookie) return null;

  const token = sessionCookie.slice(prefix.length);
  return verifyAdminSessionToken(token);
}

/**
 * Generates Set-Cookie header string for the admin session.
 */
export function createSessionCookieString(token: string): string {
  const isProd = process.env.NODE_ENV === "production";
  const secureFlag = isProd ? "; Secure" : "";
  return `${ADMIN_SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secureFlag}`;
}

/**
 * Generates Set-Cookie header string to clear the admin session.
 */
export function clearSessionCookieString(): string {
  const isProd = process.env.NODE_ENV === "production";
  const secureFlag = isProd ? "; Secure" : "";
  return `${ADMIN_SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secureFlag}`;
}

/**
 * Helper to authenticate incoming requests to /api/admin/* routes.
 * Fails closed with standard JSON error response and no-store headers.
 */
export function verifyAdminRequest(req: Request):
  | { session: AdminSessionPayload; errorResponse: null }
  | { session: null; errorResponse: NextResponse } {
  if (!isOwnerAuthConfigured()) {
    return {
      session: null,
      errorResponse: NextResponse.json(
        { error: "Owner authentication not configured. Configure ADMIN_GOOGLE_* in Netlify." },
        {
          status: 503,
          headers: { "Cache-Control": "no-store, no-cache, must-revalidate, private" },
        },
      ),
    };
  }

  const cookieHeader = req.headers.get("cookie");
  const session = getAdminSessionFromCookie(cookieHeader);

  if (!session) {
    return {
      session: null,
      errorResponse: NextResponse.json(
        { error: "Unauthorized: Owner session required" },
        {
          status: 401,
          headers: { "Cache-Control": "no-store, no-cache, must-revalidate, private" },
        },
      ),
    };
  }

  return { session, errorResponse: null };
}
