import { NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/cloud/auth";
import { getServerSupabase } from "@/lib/cloud/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get("deviceId");

    if (!deviceId) {
      return NextResponse.json({ error: "deviceId required" }, { status: 400 });
    }

    const supabase = await getServerSupabase();
    if (!supabase) {
      return NextResponse.json({ notifications: [] });
    }

    const user = await getVerifiedUser(supabase);
    if (!user) {
      return NextResponse.json({ notifications: [] });
    }

    const query = supabase
      .from("user_notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ notifications: data ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch notifications";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { notificationId, markAll, deviceId } = body;

    const supabase = await getServerSupabase();
    if (!supabase) {
      return NextResponse.json({ status: "ok" });
    }
    const user = await getVerifiedUser(supabase);
    if (!user) {
      return NextResponse.json({ status: "local_only" });
    }

    const now = new Date().toISOString();

    if (markAll && deviceId) {
      const query = supabase.from("user_notifications").update({ read_at: now }).eq("user_id", user.id);
      await query;
      return NextResponse.json({ status: "marked_all_read" });
    }

    if (notificationId) {
      await supabase
        .from("user_notifications")
        .update({ read_at: now })
        .eq("user_id", user.id)
        .eq("id", notificationId);
      return NextResponse.json({ status: "marked_read" });
    }

    return NextResponse.json({ error: "Missing notificationId or markAll" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
