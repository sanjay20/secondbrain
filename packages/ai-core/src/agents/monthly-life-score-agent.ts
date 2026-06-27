import { SYSTEM_PROMPT_BASE } from "../client";
import { getChatConfig } from "../ai-config";
import { chat } from "../provider";
import { shouldMockAI } from "../shared";

// The six life pillars scored each month. Kept inline (as a string union) to
// avoid adding @secondbrain/types as a package dependency, mirroring
// weekly-review-agent.
export type LifePillar =
  | "career"
  | "wealth"
  | "health"
  | "knowledge"
  | "relationships"
  | "personal";

export const LIFE_PILLARS: LifePillar[] = [
  "career",
  "wealth",
  "health",
  "knowledge",
  "relationships",
  "personal",
];

// Per-pillar aggregates. Activity pillars use month-windowed counts; state
// pillars use the current snapshot. Only counts/aggregates reach the AI — never
// raw journal/gratitude text (privacy, OQ-4).
export interface MonthlyLifeScoreContext {
  userName: string;
  monthLabel: string; // e.g. "June 2026"
  career: {
    activeGoals: number;
    completedGoalsThisMonth: number;
    milestonesCompletedThisMonth: number;
    avgGoalProgressPct: number;
  };
  wealth: {
    incomePaise: number;
    expensePaise: number;
    netCashflowPaise: number;
    investmentCount: number;
    savingsProgressPct: number; // avg current/target across savings goals
  };
  health: {
    habitCompletionPct: number; // completed / possible over the month
    workoutCount: number;
    workoutMinutes: number;
    avgMood: number | null; // 1–5 mood log average, null if none
  };
  knowledge: {
    skillCount: number;
    avgSkillLevel: number; // 1–10
    notesLoggedThisMonth: number; // knowledge-area journal entries
  };
  relationships: {
    journalEntriesThisMonth: number; // relationship-tagged entries (count only)
    gratitudeEntriesThisMonth: number;
  };
  personal: {
    journalEntriesThisMonth: number;
    affirmationCount: number;
    moodCheckins: number; // mood logs in the month
    gratitudeEntriesThisMonth: number;
  };
}

export interface PillarScore {
  pillar: LifePillar;
  score: number; // 1–10 integer
  explanation: string;
}

export interface MonthlyLifeScoreOutput {
  scores: PillarScore[];
}

function clampScore(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : 1;
  return Math.min(10, Math.max(1, v));
}

function trimExplanation(s: unknown, fallback: string): string {
  if (typeof s === "string" && s.trim().length > 0) return s.trim();
  return fallback;
}

// Deterministic signal count per pillar — drives the offline mock score and
// the "insufficient data" detection used to fill missing pillars.
function pillarSignal(ctx: MonthlyLifeScoreContext, pillar: LifePillar): number {
  switch (pillar) {
    case "career":
      return (
        ctx.career.activeGoals +
        ctx.career.completedGoalsThisMonth +
        ctx.career.milestonesCompletedThisMonth +
        (ctx.career.avgGoalProgressPct > 0 ? 1 : 0)
      );
    case "wealth":
      return (
        (ctx.wealth.incomePaise > 0 ? 1 : 0) +
        (ctx.wealth.expensePaise > 0 ? 1 : 0) +
        ctx.wealth.investmentCount +
        (ctx.wealth.savingsProgressPct > 0 ? 1 : 0)
      );
    case "health":
      return (
        (ctx.health.habitCompletionPct > 0 ? 1 : 0) +
        ctx.health.workoutCount +
        (ctx.health.avgMood !== null ? 1 : 0)
      );
    case "knowledge":
      return ctx.knowledge.skillCount + ctx.knowledge.notesLoggedThisMonth;
    case "relationships":
      return (
        ctx.relationships.journalEntriesThisMonth +
        ctx.relationships.gratitudeEntriesThisMonth
      );
    case "personal":
      return (
        ctx.personal.journalEntriesThisMonth +
        ctx.personal.affirmationCount +
        ctx.personal.moodCheckins +
        ctx.personal.gratitudeEntriesThisMonth
      );
  }
}

// Map a raw signal count to a 1–10 score deterministically (mock + fallback).
function mockScoreFromSignal(signal: number): number {
  if (signal <= 0) return 2;
  return clampScore(3 + Math.min(7, Math.round(Math.log2(signal + 1) * 2)));
}

function mockExplanation(
  ctx: MonthlyLifeScoreContext,
  pillar: LifePillar,
  signal: number
): string {
  if (signal <= 0) {
    return `Little or no ${pillar} activity was logged in ${ctx.monthLabel}. Capture more data here to get a meaningful score.`;
  }
  switch (pillar) {
    case "career":
      return `${ctx.career.completedGoalsThisMonth} goal(s) completed and ${ctx.career.milestonesCompletedThisMonth} milestone(s) hit this month, averaging ${ctx.career.avgGoalProgressPct}% progress across ${ctx.career.activeGoals} active goal(s).`;
    case "wealth":
      return `Net cashflow tracked across income and expenses, ${ctx.wealth.investmentCount} investment(s), and ${ctx.wealth.savingsProgressPct}% average savings-goal progress.`;
    case "health":
      return `${ctx.health.habitCompletionPct}% habit completion with ${ctx.health.workoutCount} workout(s) (${ctx.health.workoutMinutes} min)${ctx.health.avgMood !== null ? ` and an average mood of ${ctx.health.avgMood}/5` : ""}.`;
    case "knowledge":
      return `${ctx.knowledge.skillCount} skill(s) at an average level of ${ctx.knowledge.avgSkillLevel}, plus ${ctx.knowledge.notesLoggedThisMonth} note(s) captured this month.`;
    case "relationships":
      return `${ctx.relationships.journalEntriesThisMonth} relationship-related reflection(s) and ${ctx.relationships.gratitudeEntriesThisMonth} gratitude note(s) this month.`;
    case "personal":
      return `${ctx.personal.journalEntriesThisMonth} journal entr(ies), ${ctx.personal.moodCheckins} mood check-in(s), and ${ctx.personal.affirmationCount} affirmation(s) supporting personal growth.`;
  }
}

function getMockMonthlyLifeScore(
  ctx: MonthlyLifeScoreContext
): MonthlyLifeScoreOutput {
  return {
    scores: LIFE_PILLARS.map((pillar) => {
      const signal = pillarSignal(ctx, pillar);
      return {
        pillar,
        score: mockScoreFromSignal(signal),
        explanation: mockExplanation(ctx, pillar, signal),
      };
    }),
  };
}

// Guarantee exactly the six pillars in canonical order. Missing or malformed
// pillars are filled with a low "insufficient data" score so the radar always
// renders all axes (NFR-4 / AC-6).
function normalizeScores(
  ctx: MonthlyLifeScoreContext,
  raw: Array<Partial<PillarScore>> | undefined
): PillarScore[] {
  const byPillar = new Map<string, Partial<PillarScore>>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item && typeof item.pillar === "string") {
        byPillar.set(item.pillar, item);
      }
    }
  }
  return LIFE_PILLARS.map((pillar) => {
    const signal = pillarSignal(ctx, pillar);
    const found = byPillar.get(pillar);
    if (!found) {
      return {
        pillar,
        score: mockScoreFromSignal(signal),
        explanation: mockExplanation(ctx, pillar, signal),
      };
    }
    return {
      pillar,
      score: clampScore(found.score),
      explanation: trimExplanation(
        found.explanation,
        mockExplanation(ctx, pillar, signal)
      ),
    };
  });
}

function fmtMoney(paise: number): string {
  return `₹${(paise / 100).toFixed(0)}`;
}

export async function generateMonthlyLifeScore(
  ctx: MonthlyLifeScoreContext
): Promise<MonthlyLifeScoreOutput> {
  if (shouldMockAI()) return getMockMonthlyLifeScore(ctx);

  const prompt = `Score ${ctx.userName}'s life across the six pillars for ${ctx.monthLabel}, on a scale of 1 (struggling / no activity) to 10 (excellent). Base each score ONLY on the aggregated data below. Score pillars with little or no data LOW (do not skip them or error). Note: "activity" pillars (health, parts of wealth/career, relationships, personal) reflect what happened during ${ctx.monthLabel}; "state" pillars (net worth standing, goals, skill levels, savings standing) reflect the current snapshot.

CAREER (state + monthly activity):
- active goals: ${ctx.career.activeGoals}
- goals completed this month: ${ctx.career.completedGoalsThisMonth}
- milestones completed this month: ${ctx.career.milestonesCompletedThisMonth}
- average goal progress: ${ctx.career.avgGoalProgressPct}%

WEALTH (monthly cashflow + current standing):
- income this month: ${fmtMoney(ctx.wealth.incomePaise)}
- expenses this month: ${fmtMoney(ctx.wealth.expensePaise)}
- net cashflow: ${fmtMoney(ctx.wealth.netCashflowPaise)}
- investments held: ${ctx.wealth.investmentCount}
- savings-goal progress: ${ctx.wealth.savingsProgressPct}%

HEALTH (monthly activity):
- habit completion: ${ctx.health.habitCompletionPct}%
- workouts: ${ctx.health.workoutCount} (${ctx.health.workoutMinutes} min total)
- average mood: ${ctx.health.avgMood !== null ? `${ctx.health.avgMood}/5` : "no data"}

KNOWLEDGE (state + monthly activity):
- skills tracked: ${ctx.knowledge.skillCount} (avg level ${ctx.knowledge.avgSkillLevel}/10)
- notes/captures this month: ${ctx.knowledge.notesLoggedThisMonth}

RELATIONSHIPS (monthly activity, aggregate only):
- relationship reflections this month: ${ctx.relationships.journalEntriesThisMonth}
- gratitude notes this month: ${ctx.relationships.gratitudeEntriesThisMonth}

PERSONAL (monthly activity, aggregate only):
- journal entries this month: ${ctx.personal.journalEntriesThisMonth}
- mood check-ins this month: ${ctx.personal.moodCheckins}
- affirmations: ${ctx.personal.affirmationCount}
- gratitude notes this month: ${ctx.personal.gratitudeEntriesThisMonth}

Return ONLY valid JSON in exactly this shape:
{"scores": [{"pillar": "career"|"wealth"|"health"|"knowledge"|"relationships"|"personal", "score": integer 1-10, "explanation": string (2-4 sentences, specific to the data, encouraging but honest)}]}
Include all six pillars exactly once. No markdown, no code fences, no prose outside the JSON.`;

  const raw = await chat(getChatConfig("monthlyLifeScore"), SYSTEM_PROMPT_BASE, prompt);

  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned) as { scores?: Array<Partial<PillarScore>> };
    return { scores: normalizeScores(ctx, parsed.scores) };
  } catch {
    // Fallback: return deterministic mock on parse failure.
    return getMockMonthlyLifeScore(ctx);
  }
}
