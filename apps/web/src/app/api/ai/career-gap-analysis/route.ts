import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateCareerGapAnalysis, aiErrorMessage } from "@secondbrain/ai-core";
import type { CareerGapContext, CareerGapOutput } from "@secondbrain/ai-core";

export const maxDuration = 60; // outlive the in-route 50s timeout so we control the 504

const TIMEOUT = Symbol("timeout");

function clampMonth(n: unknown, fallback: number): number {
  const v = typeof n === "number" ? n : Number.parseInt(String(n ?? ""), 10);
  return Number.isInteger(v) && v >= 1 && v <= 12 ? v : fallback;
}

function clampYear(n: unknown, fallback: number): number {
  const v = typeof n === "number" ? n : Number.parseInt(String(n ?? ""), 10);
  return Number.isInteger(v) && v >= 2000 && v <= 2100 ? v : fallback;
}

// Build the gap-analysis context for a user: active career goals + tracked
// career skills (with SkillGoal linkage). All queries scoped by userId (NFR-2).
async function buildContext(userId: string, userName: string): Promise<CareerGapContext> {
  const [goals, skills] = await Promise.all([
    prisma.goal.findMany({
      where: { userId, area: "career", status: "active" },
      select: { title: true, category: true, progress: true, priority: true },
    }),
    prisma.skill.findMany({
      where: { userId, area: "career" },
      select: {
        name: true,
        category: true,
        level: true,
        skillGoals: { select: { goal: { select: { title: true } } } },
      },
    }),
  ]);

  return {
    userName,
    goals: goals.map((g) => ({
      title: g.title,
      category: g.category,
      progress: g.progress,
      priority: g.priority,
    })),
    skills: skills.map((s) => ({
      name: s.name,
      category: s.category,
      level: s.level,
      relatedGoalTitles: s.skillGoals.map((sg) => sg.goal.title),
    })),
  };
}

// The zero-goals backstop response (FR-7 / AC-3): no AI call, no upsert.
function emptyGoalsAnalysis(): CareerGapOutput {
  return {
    gaps: [],
    suggestedSkill: { name: "", rationale: "", relatedGoalTitle: null },
    summary: "Add a career goal to get a gap analysis.",
  };
}

// POST: generate (or regenerate) the analysis for the requested month and upsert.
export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const body = (await req.json().catch(() => ({}))) as { year?: number; month?: number };
    const year = clampYear(body.year, now.getUTCFullYear());
    const month = clampMonth(body.month, now.getUTCMonth() + 1);

    const context = await buildContext(user.id, user.name ?? "there");

    // FR-7 backstop: zero active goals → friendly message, no AI, no upsert.
    // (Zero skills is NOT a backstop — the analysis still runs, AC-9.)
    if (context.goals.length === 0) {
      return NextResponse.json({ analysis: emptyGoalsAnalysis(), cached: false });
    }

    // Cap the analysis and return a clean 504 on timeout (Opus latency).
    const analysis = (await Promise.race([
      generateCareerGapAnalysis(context),
      new Promise((_, reject) => setTimeout(() => reject(TIMEOUT), 50_000)),
    ])) as CareerGapOutput;

    const content = analysis as unknown as Prisma.InputJsonValue;
    await prisma.aiCareerGapAnalysis.upsert({
      where: { userId_year_month: { userId: user.id, year, month } },
      update: { content },
      create: { userId: user.id, year, month, content },
    });

    return NextResponse.json({ analysis, cached: false });
  } catch (err) {
    if (err === TIMEOUT) {
      return NextResponse.json(
        { error: "Career gap analysis timed out. Please try again." },
        { status: 504 }
      );
    }
    console.error("[CAREER GAP ANALYSIS] error:", err);
    return NextResponse.json({ error: aiErrorMessage(err) }, { status: 500 });
  }
}

// GET ?year=&month= : return the stored month's analysis without calling the AI
// (AC-2). Returns { analysis: null } when nothing is stored yet.
export async function GET(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const url = new URL(req.url);
    const year = clampYear(url.searchParams.get("year"), now.getUTCFullYear());
    const month = clampMonth(url.searchParams.get("month"), now.getUTCMonth() + 1);

    const row = await prisma.aiCareerGapAnalysis.findUnique({
      where: { userId_year_month: { userId: user.id, year, month } },
    });

    if (!row) {
      return NextResponse.json({ analysis: null });
    }

    return NextResponse.json({ analysis: row.content, cached: true });
  } catch (err) {
    console.error("[CAREER GAP ANALYSIS] GET error:", err);
    return NextResponse.json({ error: aiErrorMessage(err) }, { status: 500 });
  }
}
