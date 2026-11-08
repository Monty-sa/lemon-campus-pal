import { NextResponse } from "next/server";
import {
  isOwnerAuthConfigured,
  verifyOAuthState,
  isOwnerAuthorized,
  createAdminSessionToken,
  createSessionCookieString,
  ADMIN_STATE_COOKIE_NAME,
} from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

interface GoogleIdTokenPayload {
  iss?: string;
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
  exp?: number;
}

function parseJwtPayload(token: string): GoogleIdTokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const decoded = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(decoded) as GoogleIdTokenPayload;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const reqUrl = new URL(req.url);
  const code = reqUrl.searchParams.get("code");
  const state = reqUrl.searchParams.get("state");
  const errorParam = reqUrl.searchParams.get("error");

  if (!isOwnerAuthConfigured()) {
    return NextResponse.redirect(new URL("/admin?error=missing_config", req.url));
  }

  if (errorParam || !code || !state) {
    return NextResponse.redirect(new URL("/admin?error=google_denied", req.url));
  }

  // 1. Verify CSRF State
  const cookieHeader = req.headers.get("cookie") || "";
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const stateCookie = cookies.find((c) => c.startsWith(`${ADMIN_STATE_COOKIE_NAME}=`))?.slice(`${ADMIN_STATE_COOKIE_NAME}=`.length);

  const isStateValid = verifyOAuthState(state, stateCookie);
  if (!isStateValid) {
    return NextResponse.redirect(new URL("/admin?error=invalid_state", req.url));
  }

  const clientId = process.env.ADMIN_GOOGLE_CLIENT_ID!.trim();
  const clientSecret = process.env.ADMIN_GOOGLE_CLIENT_SECRET!.trim();
  const redirectUri = `${reqUrl.origin}/api/admin/auth/callback`;

  try {
    // 2. Exchange code for Google tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(new URL("/admin?error=token_exchange_failed", req.url));
    }

    const tokenData = (await tokenRes.json()) as { id_token?: string; access_token?: string };
    if (!tokenData.id_token) {
      return NextResponse.redirect(new URL("/admin?error=missing_id_token", req.url));
    }

    // 3. Validate ID Token claims
    const payload = parseJwtPayload(tokenData.id_token);
    if (!payload || !payload.email || !payload.sub) {
      return NextResponse.redirect(new URL("/admin?error=invalid_token_payload", req.url));
    }

    // Issuer check
    const validIssuers = ["https://accounts.google.com", "accounts.google.com"];
    if (!payload.iss || !validIssuers.includes(payload.iss)) {
      return NextResponse.redirect(new URL("/admin?error=invalid_issuer", req.url));
    }

    // Audience check
    if (payload.aud !== clientId) {
      return NextResponse.redirect(new URL("/admin?error=invalid_audience", req.url));
    }

    // Email verification check
    const emailVerified = payload.email_verified === true || payload.email_verified === "true";
    if (!emailVerified) {
      return NextResponse.redirect(new URL("/admin?error=email_not_verified", req.url));
    }

    // Expiration check
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return NextResponse.redirect(new URL("/admin?error=token_expired", req.url));
    }

    // 4. Strict Owner Allowlist Authorization
    if (!isOwnerAuthorized(payload.email, payload.sub)) {
      return NextResponse.redirect(new URL("/admin?error=access_denied", req.url));
    }

    // 5. Issue HMAC-signed Owner Session
    const sessionToken = createAdminSessionToken({
      email: payload.email,
      sub: payload.sub,
      name: payload.name,
      picture: payload.picture,
    });

    const isProd = process.env.NODE_ENV === "production";
    const secureFlag = isProd ? "; Secure" : "";

    const response = NextResponse.redirect(new URL("/admin", req.url));
    response.headers.append("Set-Cookie", createSessionCookieString(sessionToken));
    response.headers.append(
      "Set-Cookie",
      `${ADMIN_STATE_COOKIE_NAME}=; Path=/api/admin/auth; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secureFlag}`,
    );
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");

    return response;
  } catch {
    return NextResponse.redirect(new URL("/admin?error=oauth_error", req.url));
  }
}
