import { NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/cloud/auth";
import { getServerSupabase } from "@/lib/cloud/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { deviceId, endpoint, keys, subscribedCrns, quietHoursEnabled, quietHoursStart, quietHoursEnd } = body;

    if (!deviceId || typeof deviceId !== "string" || deviceId.length < 10) {
      return NextResponse.json({ error: "Invalid deviceId" }, { status: 400 });
    }

    if (!endpoint || typeof endpoint !== "string" || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: "Invalid push subscription credentials" }, { status: 400 });
    }

    const supabase = await getServerSupabase();
    if (!supabase) {
      // Local fallback: acknowledge client that server storage is offline, client will retain local subscription
      return NextResponse.json({ status: "acknowledged_local_only" });
    }

    const user = await getVerifiedUser(supabase);
    if (!user) {
      return NextResponse.json({ status: "acknowledged_local_only" });
    }

    const { data, error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          device_id: deviceId,
          user_id: user.id,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          subscribed_crns: Array.isArray(subscribedCrns) ? subscribedCrns : [],
          quiet_hours_enabled: Boolean(quietHoursEnabled),
          quiet_hours_start: quietHoursStart || "22:00",
          quiet_hours_end: quietHoursEnd || "07:00",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "device_id,endpoint" },
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ status: "subscribed", subscription: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Subscription error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { deviceId, endpoint } = body;

    if (!deviceId || !endpoint) {
      return NextResponse.json({ error: "deviceId and endpoint are required" }, { status: 400 });
    }

    const supabase = await getServerSupabase();
    if (supabase) {
      const user = await getVerifiedUser(supabase);
      if (!user) return NextResponse.json({ status: "local_only" });
      const { error } = await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id)
        .match({ device_id: deviceId, endpoint });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ status: "unsubscribed" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unsubscribe error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
