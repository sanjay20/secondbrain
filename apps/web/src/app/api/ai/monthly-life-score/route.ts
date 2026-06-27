import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  generateMonthlyLifeScore,
  LIFE_PILLARS,
  aiErrorMessage,
} from "@secondbrain/ai-core";
import type {
  MonthlyLifeScoreContext,
  MonthlyLifeScoreOutput,
  PillarScore,
  LifePillar,
} from "@secondbrain/ai-core";
import { monthRange } from "@/lib/datetime";

export const maxDuration = 60; // outlive the in-route 50s timeout so we control the 504

const TIMEOUT = Symbol("timeout");

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type TrendDirection = "up" | "down" | "flat" | "none";

interface PillarTrend {
  pillar: LifePillar;
  delta: number; // current − prior; 0 when no prior data
  direction: TrendDirection;
}

interface ScorePayload {
  year: number;
  month: number;
  monthLabel: string;
  scores: PillarScore[];
  trend: PillarTrend[];
}

// Reads {scores} out of a stored Json content blob defensively.
function readScores(content: Prisma.JsonValue | null | undefined): PillarScore[] {
  if (content && typeof content === "object" && !Array.isArray(content)) {
    const scores = (content as { scores?: unknown }).scores;
    if (Array.isArray(scores)) return scores as PillarScore[];
  }
  return [];
}

// Compute per-pillar trend by diffing the current scores against the prior
// month's stored row. AC-3/AC-4: "none" direction when there is no prior data.
function computeTrend(
  current: PillarScore[],
  prior: PillarScore[] | null
): PillarTrend[] {
  const priorByPillar = new Map<string, number>();
  if (prior) for (const p of prior) priorByPillar.set(p.pillar, p.score);
  const currentByPillar = new Map<string, number>();
  for (const c of current) currentByPillar.set(c.pillar, c.score);

  return LIFE_PILLARS.map((pillar) => {
    const cur = currentByPillar.get(pillar) ?? 0;
    if (!prior || !priorByPillar.has(pillar)) {
      return { pillar, delta: 0, direction: "none" as TrendDirection };
    }
    const delta = cur - (priorByPillar.get(pillar) ?? 0);
    const direction: TrendDirection = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
    return { pillar, delta, direction };
  });
}

// Previous calendar month (handles January → December rollover).
function priorMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function clampMonth(n: unknown, fallback: number): number {
  const v = typeof n === "number" ? n : Number.parseInt(String(n ?? ""), 10);
  return Number.isInteger(v) && v >= 1 && v <= 12 ? v : fallback;
}

function clampYear(n: unknown, fallback: number): number {
  const v = typeof n === "number" ? n : Number.parseInt(String(n ?? ""), 10);
  return Number.isInteger(v) && v >= 2000 && v <= 2100 ? v : fallback;
}

// Aggregate all six pillars' inputs for the given month, scoped by userId.
async function buildContext(
  userId: string,
  userName: string,
  year: number,
  month: number,
  tz: string | null | undefined
): Promise<MonthlyLifeScoreContext> {
  // First day of the target month (UTC midnight) → monthRange gives [gte, lt).
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const range = monthRange(monthStart, tz);

  const [
    goals,
    milestonesCompleted,
    monthTransactions,
    investmentCount,
    savingsGoals,
    habits,
    habitLogs,
    workouts,
    skills,
    knowledgeNotes,
    relationshipNotes,
    moodLogs,
    journalEntries,
    affirmationCount,
    gratitudeCount,
  ] = await Promise.all([
    prisma.goal.findMany({ where: { userId } }),
    prisma.milestone.findMany({
      where: { goal: { userId }, completed: true, completedAt: { gte: range.gte, lt: range.lt } },
      select: { id: true },
    }),
    prisma.transaction.findMany({
      where: { userId, date: { gte: range.gte, lt: range.lt } },
      select: { type: true, amountPaise: true },
    }),
    prisma.investment.count({ where: { userId } }),
    prisma.savingsGoal.findMany({ where: { userId }, select: { targetPaise: true, currentPaise: true } }),
    prisma.habit.findMany({ where: { userId, isActive: true }, select: { id: true } }),
    prisma.habitLog.findMany({
      where: { userId, completed: true, date: { gte: range.gte, lt: range.lt } },
      select: { id: true },
    }),
    prisma.workout.findMany({
      where: { userId, date: { gte: range.gte, lt: range.lt } },
      select: { duration: true },
    }),
    prisma.skill.findMany({ where: { userId }, select: { level: true } }),
    prisma.journalEntry.count({
      where: { userId, category: "knowledge", createdAt: { gte: range.gte, lt: range.lt } },
    }),
    prisma.journalEntry.count({
      where: { userId, category: "relationships", createdAt: { gte: range.gte, lt: range.lt } },
    }),
    prisma.moodLog.findMany({
      where: { userId, date: { gte: range.gte, lt: range.lt } },
      select: { mood: true },
    }),
    prisma.journalEntry.count({
      where: { userId, createdAt: { gte: range.gte, lt: range.lt } },
    }),
    prisma.affirmation.count({ where: { userId } }),
    prisma.gratitudeEntry.count({
      where: { userId, date: { gte: range.gte, lt: range.lt } },
    }),
  ]);

  // ── CAREER ──
  const activeGoals = goals.filter((g) => g.status === "active");
  const completedGoalsThisMonth = goals.filter(
    (g) => g.status === "completed" && g.completedAt && g.completedAt >= range.gte && g.completedAt < range.lt
  ).length;
  const avgGoalProgressPct = activeGoals.length
    ? Math.round(activeGoals.reduce((s, g) => s + g.progress, 0) / activeGoals.length)
    : 0;

  // ── WEALTH ──
  const incomePaise = monthTransactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amountPaise, 0);
  const expensePaise = monthTransactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amountPaise, 0);
  const savingsProgressPct = savingsGoals.length
    ? Math.round(
        (savingsGoals.reduce(
          (s, g) => s + (g.targetPaise > 0 ? Math.min(1, g.currentPaise / g.targetPaise) : 0),
          0
        ) /
          savingsGoals.length) *
          100
      )
    : 0;

  // ── HEALTH ──
  // Possible completions ≈ active habits × days elapsed in the month window.
  const daysInWindow = Math.max(
    1,
    Math.round((range.lt.getTime() - range.gte.getTime()) / (24 * 60 * 60 * 1000))
  );
  const possible = habits.length * daysInWindow;
  const habitCompletionPct = possible > 0 ? Math.min(100, Math.round((habitLogs.length / possible) * 100)) : 0;
  const workoutMinutes = workouts.reduce((s, w) => s + w.duration, 0);
  const avgMood = moodLogs.length
    ? Math.round((moodLogs.reduce((s, m) => s + m.mood, 0) / moodLogs.length) * 10) / 10
    : null;

  // ── KNOWLEDGE ──
  const avgSkillLevel = skills.length
    ? Math.round((skills.reduce((s, k) => s + k.level, 0) / skills.length) * 10) / 10
    : 0;

  return {
    userName,
    monthLabel: `${MONTH_LABELS[month - 1]} ${year}`,
    career: {
      activeGoals: activeGoals.length,
      completedGoalsThisMonth,
      milestonesCompletedThisMonth: milestonesCompleted.length,
      avgGoalProgressPct,
    },
    wealth: {
      incomePaise,
      expensePaise,
      netCashflowPaise: incomePaise - expensePaise,
      investmentCount,
      savingsProgressPct,
    },
    health: {
      habitCompletionPct,
      workoutCount: workouts.length,
      workoutMinutes,
      avgMood,
    },
    knowledge: {
      skillCount: skills.length,
      avgSkillLevel,
      notesLoggedThisMonth: knowledgeNotes,
    },
    relationships: {
      journalEntriesThisMonth: relationshipNotes,
      gratitudeEntriesThisMonth: gratitudeCount,
    },
    personal: {
      journalEntriesThisMonth: journalEntries,
      affirmationCount,
      moodCheckins: moodLogs.length,
      gratitudeEntriesThisMonth: gratitudeCount,
    },
  };
}

async function loadPriorScores(
  userId: string,
  year: number,
  month: number
): Promise<PillarScore[] | null> {
  const prev = priorMonth(year, month);
  const row = await prisma.monthlyLifeScore.findUnique({
    where: { userId_year_month: { userId, year: prev.year, month: prev.month } },
  });
  if (!row) return null;
  return readScores(row.content);
}

// POST: generate (or regenerate) the score for the requested month and upsert it.
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

    const context = await buildContext(
      user.id,
      user.name ?? "there",
      year,
      month,
      user.timezone
    );

    // Cap the analysis and return a clean 504 on timeout (Opus latency).
    const output = (await Promise.race([
      generateMonthlyLifeScore(context),
      new Promise((_, reject) => setTimeout(() => reject(TIMEOUT), 50_000)),
    ])) as MonthlyLifeScoreOutput;

    const content = { scores: output.scores } as unknown as Prisma.InputJsonValue;
    await prisma.monthlyLifeScore.upsert({
      where: { userId_year_month: { userId: user.id, year, month } },
      update: { content },
      create: { userId: user.id, year, month, content },
    });

    const prior = await loadPriorScores(user.id, year, month);
    const payload: ScorePayload = {
      year,
      month,
      monthLabel: context.monthLabel,
      scores: output.scores,
      trend: computeTrend(output.scores, prior),
    };

    return NextResponse.json({ score: payload, cached: false });
  } catch (err) {
    if (err === TIMEOUT) {
      return NextResponse.json(
        { error: "Monthly life score generation timed out. Please try again." },
        { status: 504 }
      );
    }
    console.error("[MONTHLY LIFE SCORE] error:", err);
    return NextResponse.json({ error: aiErrorMessage(err) }, { status: 500 });
  }
}

// GET ?year=&month= : return the stored month's score + computed trend without
// calling the AI (AC-8). Returns score: null when nothing is stored yet.
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

    const row = await prisma.monthlyLifeScore.findUnique({
      where: { userId_year_month: { userId: user.id, year, month } },
    });

    if (!row) {
      return NextResponse.json({ score: null });
    }

    const scores = readScores(row.content);
    const prior = await loadPriorScores(user.id, year, month);
    const payload: ScorePayload = {
      year,
      month,
      monthLabel: `${MONTH_LABELS[month - 1]} ${year}`,
      scores,
      trend: computeTrend(scores, prior),
    };

    return NextResponse.json({ score: payload });
  } catch (err) {
    console.error("[MONTHLY LIFE SCORE] GET error:", err);
    return NextResponse.json({ error: aiErrorMessage(err) }, { status: 500 });
  }
}
