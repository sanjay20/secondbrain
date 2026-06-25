import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateGoalConflictReport, aiErrorMessage } from "@secondbrain/ai-core";
import type { GoalConflictContext } from "@secondbrain/ai-core";

export const maxDuration = 60; // outlive the in-route 10s timeout so we control the 504

const TIMEOUT = Symbol("timeout");

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
      });
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

    // NFR-1: cap the analysis at 10s and return a clean 504 on timeout.
    const report = await Promise.race([
      generateGoalConflictReport(context),
      new Promise((_, reject) => setTimeout(() => reject(TIMEOUT), 10_000)),
    ]);

    return NextResponse.json({ report });
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
