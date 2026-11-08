import { NextResponse } from "next/server";
import {
  isOwnerAuthConfigured,
  createOAuthState,
  getTrustedRedirectOrigin,
  ADMIN_STATE_COOKIE_NAME,
  STATE_TTL_SECONDS,
} from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isOwnerAuthConfigured()) {
    const url = new URL("/admin?error=missing_config", req.url);
    return NextResponse.redirect(url);
  }

  const clientId = process.env.ADMIN_GOOGLE_CLIENT_ID!.trim();
  const redirectUri = `${getTrustedRedirectOrigin()}/api/admin/auth/callback`;

  const { state, cookieValue } = createOAuthState();

  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", clientId);
  googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("scope", "openid email profile");
  googleAuthUrl.searchParams.set("state", state);
  googleAuthUrl.searchParams.set("prompt", "select_account");
  googleAuthUrl.searchParams.set("access_type", "online");

  const isProd = process.env.NODE_ENV === "production";
  const secureFlag = isProd ? "; Secure" : "";

  const response = NextResponse.redirect(googleAuthUrl);
  response.headers.set(
    "Set-Cookie",
    `${ADMIN_STATE_COOKIE_NAME}=${cookieValue}; Path=/api/admin/auth; HttpOnly; SameSite=Lax; Max-Age=${STATE_TTL_SECONDS}${secureFlag}`,
  );
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");

  return response;
}
