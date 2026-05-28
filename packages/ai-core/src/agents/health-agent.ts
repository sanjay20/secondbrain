import { SYSTEM_PROMPT_BASE } from "../client";
import { getChatConfig } from "../ai-config";
import { chat } from "../provider";
import { shouldMockAI } from "../shared";

interface HabitInsightContext {
  habits: Array<{
    name: string;
    category: string;
    streak: number;
    bestStreak: number;
    totalDone: number;
    completionRate: number;
  }>;
}

function getMockHabitInsights(ctx: HabitInsightContext): string {
  const top = [...ctx.habits].sort((a, b) => b.streak - a.streak)[0];
  const weakest = [...ctx.habits].sort((a, b) => a.completionRate - b.completionRate)[0];
  return `- **What's working:** "${top?.name ?? "your top habit"}" is on a ${top?.streak ?? 0}-day streak — keep protecting that momentum.
- **Needs attention:** "${weakest?.name ?? "a habit"}" has the lowest completion rate; consider shrinking it to a 2-minute version.
- **Try this:** Stack the harder habit right after one you already do reliably.

_(Mock response — set MOCK_AI=false and add Anthropic credits for live insights.)_`;
}

function getMockHabitSuggestions(currentHabits: string[]): string {
  const has = (kw: string) => currentHabits.some((h) => h.toLowerCase().includes(kw));
  return `1. ${has("water") ? "10-minute morning stretch" : "Drink a glass of water on waking"} — an easy keystone habit that builds consistency.
2. ${has("read") ? "Weekly review of your goals" : "Read 10 pages a day"} — compounds knowledge with minimal time cost.
3. Five minutes of evening planning — primes tomorrow and reduces decision fatigue.

_(Mock response — set MOCK_AI=false and add Anthropic credits for live suggestions.)_`;
}

export async function getHabitInsights(ctx: HabitInsightContext): Promise<string> {
  if (shouldMockAI()) return getMockHabitInsights(ctx);

  const habitData = ctx.habits
    .map(
      (h) =>
        `${h.name} (${h.category}): current streak ${h.streak}, best streak ${h.bestStreak}, completion rate ${Math.round(h.completionRate * 100)}%`
    )
    .join("\n");

  return chat(
    getChatConfig("healthInsight"),
    SYSTEM_PROMPT_BASE,
    `Analyze my habits and give me 2-3 specific, actionable insights:

${habitData}

Focus on: what's working, what needs attention, and one specific improvement suggestion. Be concise.`
  );
}

export async function suggestHabits(currentHabits: string[]): Promise<string> {
  if (shouldMockAI()) return getMockHabitSuggestions(currentHabits);

  return chat(
    getChatConfig("habitSuggestion"),
    SYSTEM_PROMPT_BASE,
    `Current habits: ${currentHabits.join(", ") || "none yet"}

Suggest 3 high-impact habits I should consider adding, based on what's already tracked. Give each suggestion one sentence of rationale. Format as a numbered list.`
  );
}
