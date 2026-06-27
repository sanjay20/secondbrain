import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateStreakNudge } from "@secondbrain/ai-core";
import type { NudgeContext, NudgeOutput } from "@secondbrain/ai-core";
import { findBrokenStreakHabits } from "@/lib/habit-streak";

export const maxDuration = 60; // outlive the in-route 50s timeout

const TIMEOUT = Symbol("timeout");

const NO_NUDGE: NudgeOutput = { hasNudge: false, message: "", habits: [] };

export async function POST() {
  // An unauthenticated request maps to HTTP 401.
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const habits = await findBrokenStreakHabits(
      prisma,
      user.id,
      today,
      user.timezone ?? undefined
    );

    // AC-2 backstop: no broken streaks → no nudge, no AI call.
    if (habits.length === 0) {
      return NextResponse.json(NO_NUDGE);
    }

    const context: NudgeContext = {
      userName: user.name ?? "there",
      habits,
    };

    const output = (await Promise.race([
      generateStreakNudge(context),
      new Promise((_, reject) => setTimeout(() => reject(TIMEOUT), 50_000)),
    ])) as NudgeOutput;

    return NextResponse.json(output);
  } catch (err) {
    // NFR-2 / AC-7: never surface AI failure to the UI as a 5xx. On any error or
    // timeout, return an empty nudge with HTTP 200 so the card silently renders nothing.
    console.error("[STREAK NUDGE] error:", err);
    return NextResponse.json(NO_NUDGE);
  }
}
