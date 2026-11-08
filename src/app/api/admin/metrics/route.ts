import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/cloud/server";
import { getAdminMetrics, getAdminPrivilegedSupabase, isAdminUser } from "@/lib/cloud/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const isAdmin = await isAdminUser(supabase, user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden: Admin privileges required" }, { status: 403 });
  }

  const privileged = getAdminPrivilegedSupabase();
  const metrics = await getAdminMetrics(supabase, privileged);
  return NextResponse.json(metrics);
}
