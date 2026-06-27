import { SYSTEM_PROMPT_BASE } from "../client";
import { getChatConfig } from "../ai-config";
import { chat } from "../provider";
import { shouldMockAI } from "../shared";

// Inline types to avoid adding @secondbrain/types as a package dependency
export interface NudgeHabit {
  name: string;
  category: string;
  icon: string;
  streak: number;
}

export interface NudgeContext {
  userName: string;
  habits: NudgeHabit[];
}

export interface NudgeOutput {
  hasNudge: boolean;
  message: string;
  habits: string[];
}

function getMockNudge(ctx: NudgeContext): NudgeOutput {
  if (ctx.habits.length === 0) return { hasNudge: false, message: "", habits: [] };

  const names = ctx.habits.map((h) => h.name);
  const list =
    names.length === 1
      ? `"${names[0]}"`
      : `${names.slice(0, -1).map((n) => `"${n}"`).join(", ")} and "${names[names.length - 1]}"`;

  return {
    hasNudge: true,
    message: `Hey ${ctx.userName}, you've slipped on ${list} the last couple of days — that's completely human. One small win today is all it takes to get the momentum back. You've got this.`,
    habits: names,
  };
}

function fmtHabits(ctx: NudgeContext): string {
  return ctx.habits
    .map((h) => `- "${h.name}" | category: ${h.category} | icon: ${h.icon} | lost streak: ${h.streak}`)
    .join("\n");
}

export async function generateStreakNudge(ctx: NudgeContext): Promise<NudgeOutput> {
  if (shouldMockAI()) return getMockNudge(ctx);

  // Backstop — never call the LLM with nothing to nudge about.
  if (ctx.habits.length === 0) return { hasNudge: false, message: "", habits: [] };

  const prompt = `Write a short, warm motivational nudge for ${ctx.userName}, who has missed the daily habit(s) below for two or more days in a row.

MISSED HABITS:
${fmtHabits(ctx)}

Guidance:
- 2-3 sentences, warm and encouraging — never preachy, guilt-tripping, or judgemental.
- Reference the specific habit(s) by name so it feels personal.
- Frame the break as normal and easy to recover from; invite one small step today.

Return ONLY valid JSON in exactly this shape:
{"hasNudge": boolean, "message": string, "habits": string[] (the habit names you referenced)}
No markdown, no code fences, no prose outside the JSON.`;

  const raw = await chat(getChatConfig("streakNudge"), SYSTEM_PROMPT_BASE, prompt);

  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned) as Partial<NudgeOutput>;
    const message = typeof parsed.message === "string" ? parsed.message.trim() : "";
    if (message.length === 0) return getMockNudge(ctx);
    const habits = Array.isArray(parsed.habits)
      ? parsed.habits.filter((h): h is string => typeof h === "string")
      : ctx.habits.map((h) => h.name);
    return {
      hasNudge: true,
      message,
      habits: habits.length > 0 ? habits : ctx.habits.map((h) => h.name),
    };
  } catch {
    // Fallback: return mock on parse failure (NFR-2 / AC-7 — never throw to caller).
    return getMockNudge(ctx);
  }
}
