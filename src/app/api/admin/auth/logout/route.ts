import { NextResponse } from "next/server";
import { clearSessionCookieString } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleLogout(req);
}

export async function GET(req: Request) {
  return handleLogout(req);
}

function handleLogout(req: Request) {
  const response = NextResponse.redirect(new URL("/admin", req.url));
  response.headers.set("Set-Cookie", clearSessionCookieString());
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  return response;
}
