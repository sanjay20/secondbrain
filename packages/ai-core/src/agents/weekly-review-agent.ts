import { SYSTEM_PROMPT_BASE } from "../client";
import { getChatConfig } from "../ai-config";
import { chat } from "../provider";
import { shouldMockAI } from "../shared";

// Inline types to avoid adding @secondbrain/types as a package dependency
export interface WeeklyReviewContext {
  userName: string;
  weekLabel: string; // e.g. "Jun 16–22, 2025"
  habits: Array<{ name: string; category: string; completions: number; possible: number; streak: number }>;
  tasks: { completed: number; incomplete: number; rolledOver: number };
  workouts: Array<{ type: string; duration: number }>;
  journalCount: number;
  journalMoods: string[]; // mood tags present on entries
  moods: number[]; // MoodLog scores in the window
  gratitudeCount: number;
  affirmationCount: number;
  knowledgeCount: number; // knowledge-area JournalEntry / notes count
  goals: Array<{ title: string; progress: number; status: string }>;
  career: Array<{ title: string; progress: number }>; // career-area goals + completed milestones
}

export interface WeeklyReviewOutput {
  snapshot: string; // 2–3 sentence summary
  wins: string[]; // up to 3
  gaps: string[]; // up to 3
  focusAreas: string[]; // exactly 3
}

function clamp3(arr: string[]): string[] {
  return arr.filter((s) => typeof s === "string" && s.trim().length > 0).slice(0, 3);
}

function padTo3(arr: string[], filler: string[]): string[] {
  const out = clamp3(arr);
  let i = 0;
  while (out.length < 3) {
    out.push(filler[i % filler.length] ?? "Reflect on your week and pick one small improvement.");
    i++;
  }
  return out.slice(0, 3);
}

function hasAnyData(ctx: WeeklyReviewContext): boolean {
  return (
    ctx.habits.length > 0 ||
    ctx.tasks.completed > 0 ||
    ctx.tasks.incomplete > 0 ||
    ctx.workouts.length > 0 ||
    ctx.journalCount > 0 ||
    ctx.moods.length > 0 ||
    ctx.gratitudeCount > 0 ||
    ctx.affirmationCount > 0 ||
    ctx.knowledgeCount > 0 ||
    ctx.goals.length > 0 ||
    ctx.career.length > 0
  );
}

function getMockWeeklyReview(ctx: WeeklyReviewContext): WeeklyReviewOutput {
  if (!hasAnyData(ctx)) {
    return {
      snapshot: `A quiet week for ${ctx.userName}, with little logged across your pillars (${ctx.weekLabel}). That's a perfectly fine place to start — the more you capture, the richer these reviews become.`,
      wins: ["You showed up to reflect on your week — that's the first step."],
      gaps: ["Very little activity was logged across habits, tasks, journal, and goals this week."],
      focusAreas: [
        "Log at least one habit completion each day this week.",
        "Capture a short journal entry or mood check-in daily.",
        "Set or revisit one active goal to give the week direction.",
      ],
    };
  }

  const habitRate = (() => {
    const totalPossible = ctx.habits.reduce((s, h) => s + h.possible, 0);
    const totalDone = ctx.habits.reduce((s, h) => s + h.completions, 0);
    return totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0;
  })();

  const wins: string[] = [];
  if (ctx.tasks.completed > 0) wins.push(`Completed ${ctx.tasks.completed} task(s) this week.`);
  if (ctx.workouts.length > 0) wins.push(`Logged ${ctx.workouts.length} workout(s).`);
  const topStreak = ctx.habits.reduce((m, h) => Math.max(m, h.streak), 0);
  if (topStreak > 0) wins.push(`Maintained a ${topStreak}-day habit streak.`);
  if (wins.length === 0 && ctx.journalCount > 0) wins.push(`Journaled ${ctx.journalCount} time(s).`);

  const gaps: string[] = [];
  if (ctx.tasks.rolledOver > 0) gaps.push(`${ctx.tasks.rolledOver} task(s) rolled over without completion.`);
  if (habitRate < 70 && ctx.habits.length > 0) gaps.push(`Habit completion was ${habitRate}% — room to be more consistent.`);
  if (ctx.workouts.length === 0) gaps.push("No workouts were logged this week.");

  return {
    snapshot: `${ctx.userName} had an active week (${ctx.weekLabel}): ${ctx.tasks.completed} tasks done, ${ctx.workouts.length} workouts, ${ctx.journalCount} journal entries, and ${habitRate}% habit completion. Solid momentum with a few areas to tighten up.`,
    wins: clamp3(wins.length ? wins : ["You logged activity across multiple pillars this week."]),
    gaps: clamp3(gaps.length ? gaps : ["No major gaps — keep the consistency going."]),
    focusAreas: padTo3(
      [
        ctx.tasks.rolledOver > 0 ? "Clear rolled-over tasks early in the week." : "Plan your top 3 priorities each morning.",
        ctx.workouts.length === 0 ? "Schedule at least two workouts this week." : "Keep your workout cadence going.",
        ctx.habits.length > 0 ? "Protect your strongest habit streak." : "Add one keystone habit to track.",
      ],
      ["Reflect daily on one thing that went well.", "Revisit an active goal and take one concrete step."]
    ),
  };
}

function fmtHabits(ctx: WeeklyReviewContext): string {
  if (ctx.habits.length === 0) return "  (no active habits)";
  return ctx.habits
    .map((h) => `- "${h.name}" (${h.category}): ${h.completions}/${h.possible} this week, ${h.streak}-day streak`)
    .join("\n");
}

function fmtWorkouts(ctx: WeeklyReviewContext): string {
  if (ctx.workouts.length === 0) return "  (none logged)";
  return ctx.workouts.map((w) => `- ${w.type}, ${w.duration} min`).join("\n");
}

function fmtGoals(ctx: WeeklyReviewContext): string {
  if (ctx.goals.length === 0) return "  (no active goals)";
  return ctx.goals.map((g) => `- "${g.title}" — ${g.status}, ${g.progress}% (current state)`).join("\n");
}

function fmtCareer(ctx: WeeklyReviewContext): string {
  if (ctx.career.length === 0) return "  (no career goals or milestones)";
  return ctx.career.map((c) => `- "${c.title}" — ${c.progress}%`).join("\n");
}

export async function generateWeeklyReview(ctx: WeeklyReviewContext): Promise<WeeklyReviewOutput> {
  if (shouldMockAI()) return getMockWeeklyReview(ctx);

  const avgMood =
    ctx.moods.length > 0 ? (ctx.moods.reduce((s, m) => s + m, 0) / ctx.moods.length).toFixed(1) : "n/a";

  const prompt = `Write a weekly life review for ${ctx.userName} covering the week of ${ctx.weekLabel}.
Synthesise the data below across all pillars into an honest, encouraging retrospective.

HABITS:
${fmtHabits(ctx)}

TASKS (Daily Work):
- completed: ${ctx.tasks.completed}
- incomplete: ${ctx.tasks.incomplete}
- rolled over: ${ctx.tasks.rolledOver}

HEALTH / WORKOUTS:
${fmtWorkouts(ctx)}

JOURNAL:
- entries: ${ctx.journalCount}
- mood tags: ${ctx.journalMoods.length ? ctx.journalMoods.join(", ") : "none"}

MINDSET:
- mood log scores: ${ctx.moods.length ? ctx.moods.join(", ") : "none"} (avg ${avgMood})
- gratitude entries: ${ctx.gratitudeCount}
- affirmations: ${ctx.affirmationCount}

KNOWLEDGE:
- notes/captures logged: ${ctx.knowledgeCount}

VISION (Goals):
${fmtGoals(ctx)}

CAREER:
${fmtCareer(ctx)}

Return ONLY valid JSON in exactly this shape:
{"snapshot": string (2-3 sentences), "wins": string[] (up to 3 concrete achievements), "gaps": string[] (up to 3 areas the user fell short or was absent), "focusAreas": string[] (exactly 3 specific, actionable recommendations for next week)}
No markdown, no code fences, no prose outside the JSON.
If the week is sparse or empty, still produce an encouraging snapshot that acknowledges the lack of data and make the focus areas about logging more consistently.`;

  const raw = await chat(getChatConfig("weeklyReview"), SYSTEM_PROMPT_BASE, prompt);

  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned) as Partial<WeeklyReviewOutput>;
    const snapshot =
      typeof parsed.snapshot === "string" && parsed.snapshot.trim().length > 0
        ? parsed.snapshot.trim()
        : getMockWeeklyReview(ctx).snapshot;
    return {
      snapshot,
      wins: clamp3(Array.isArray(parsed.wins) ? parsed.wins : []),
      gaps: clamp3(Array.isArray(parsed.gaps) ? parsed.gaps : []),
      focusAreas: padTo3(Array.isArray(parsed.focusAreas) ? parsed.focusAreas : [], [
        "Reflect daily on one thing that went well.",
        "Revisit an active goal and take one concrete step.",
        "Log your habits and mood consistently this week.",
      ]),
    };
  } catch {
    // Fallback: return mock on parse failure
    return getMockWeeklyReview(ctx);
  }
}
