import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateGoalConflictReport, aiErrorMessage } from "@secondbrain/ai-core";
import type { GoalConflictContext, GoalConflictOutput } from "@secondbrain/ai-core";

export const maxDuration = 60; // outlive the in-route 50s timeout so we control the 504

const TIMEOUT = Symbol("timeout");

// The cache is primarily invalidated by goal changes (inputHash). This backstop
// only forces a refresh after a long idle so deadline-relative framing doesn't
// go calendar-stale when the goals themselves haven't changed.
const BACKSTOP_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

type CacheableGoal = {
  id: string;
  title: string;
  area: string;
  priority: string;
  dueDate: Date | null;
};

// Fingerprint the goal fields that actually drive conflict detection. Progress
// is deliberately excluded so routine progress nudges don't churn the cache.
function fingerprintGoals(goals: CacheableGoal[]): string {
  const stable = goals
    .map((g) => `${g.id}|${g.title}|${g.area}|${g.priority}|${g.dueDate?.toISOString() ?? ""}`)
    .sort()
    .join("\n");
  return createHash("sha256").update(stable).digest("hex");
}

export async function POST() {
  // AC-5: an unauthenticated request maps to HTTP 401.
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const goals = await prisma.goal.findMany({
      where: { userId: user.id, status: "active" },
      select: { id: true, title: true, area: true, priority: true, progress: true, dueDate: true },
    });

    // FR-6 backstop: don't call the AI with fewer than two goals.
    if (goals.length < 2) {
      return NextResponse.json({
        report: {
          hasConflicts: false,
          conflicts: [],
          suggestions: [],
          summary: "Add at least two active goals to check for conflicts.",
        },
        cached: false,
      });
    }

    // Serve from cache when the goals are unchanged (same fingerprint) and the
    // backstop hasn't expired. Otherwise regenerate — this skips the AI entirely
    // while goals are stable and refreshes immediately when they change.
    const inputHash = fingerprintGoals(goals);
    const cached = await prisma.aiGoalConflict.findUnique({ where: { userId: user.id } });
    if (
      cached &&
      cached.inputHash === inputHash &&
      Date.now() - cached.updatedAt.getTime() < BACKSTOP_TTL_MS
    ) {
      return NextResponse.json({ report: cached.content, cached: true });
    }

    const context: GoalConflictContext = {
      userName: user.name ?? "there",
      goals: goals.map((g) => ({
        id: g.id,
        title: g.title,
        area: g.area,
        priority: g.priority,
        progress: g.progress,
        dueDate: g.dueDate ? g.dueDate.toISOString() : null,
      })),
    };

    // Cap the analysis and return a clean 504 on timeout. Opus analysing many
    // goals is slower than Sonnet, so allow 50s (under the 60s maxDuration).
    const report = (await Promise.race([
      generateGoalConflictReport(context),
      new Promise((_, reject) => setTimeout(() => reject(TIMEOUT), 50_000)),
    ])) as GoalConflictOutput;

    // Persist as the new cache entry (records the fingerprint + resets updatedAt).
    const content = report as unknown as Prisma.InputJsonValue;
    await prisma.aiGoalConflict.upsert({
      where: { userId: user.id },
      update: { content, inputHash },
      create: { userId: user.id, content, inputHash },
    });

    return NextResponse.json({ report, cached: false });
  } catch (err) {
    if (err === TIMEOUT) {
      return NextResponse.json(
        { error: "Goal conflict analysis timed out. Please try again." },
        { status: 504 }
      );
    }
    console.error("[GOAL CONFLICT] error:", err);
    return NextResponse.json({ error: aiErrorMessage(err) }, { status: 500 });
  }
}
