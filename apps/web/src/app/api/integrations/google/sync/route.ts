import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listTodayEvents } from "@/lib/google";

export async function POST() {
  const user = await requireUser();
  const tz = user.timezone ?? process.env.APP_TZ ?? "UTC";

  try {
    const events = await listTodayEvents(user.id, tz);
    return NextResponse.json({ events });
  } catch (err) {
    console.error("[GOOGLE SYNC] error:", err);
    return NextResponse.json(
      { error: "Failed to sync Google Calendar events" },
      { status: 502 }
    );
  }
}
