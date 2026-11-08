import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/cloud/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorDescription = searchParams.get("error_description") || searchParams.get("error");
  const next = searchParams.get("next") ?? "/";
  const requestedNext = new URL(next, origin);
  const safeNext = next.startsWith("/") && requestedNext.origin === origin
    ? requestedNext
    : new URL("/", origin);

  if (code) {
    const supabase = await getServerSupabase();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(safeNext);
      }
      safeNext.searchParams.set("auth_error", error.message);
      return NextResponse.redirect(safeNext);
    }
  }

  safeNext.searchParams.set("auth_error", errorDescription ?? "exchange_failed");
  return NextResponse.redirect(safeNext);
}
