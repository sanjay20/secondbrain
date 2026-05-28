import { anthropic, SYSTEM_PROMPT_BASE } from "../client";
import { AI_CONFIG } from "../ai-config";

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

export async function getHabitInsights(ctx: HabitInsightContext): Promise<string> {
  const habitData = ctx.habits
    .map(
      (h) =>
        `${h.name} (${h.category}): current streak ${h.streak}, best streak ${h.bestStreak}, completion rate ${Math.round(h.completionRate * 100)}%`
    )
    .join("\n");

  const message = await anthropic.messages.create({
    model: AI_CONFIG.healthInsight.model,
    max_tokens: AI_CONFIG.healthInsight.maxTokens,
    system: SYSTEM_PROMPT_BASE,
    messages: [
      {
        role: "user",
        content: `Analyze my habits and give me 2-3 specific, actionable insights:

${habitData}

Focus on: what's working, what needs attention, and one specific improvement suggestion. Be concise.`,
      },
    ],
  });

  return (message.content[0] as { type: string; text: string }).text;
}

export async function suggestHabits(currentHabits: string[]): Promise<string> {
  const message = await anthropic.messages.create({
    model: AI_CONFIG.habitSuggestion.model,
    max_tokens: AI_CONFIG.habitSuggestion.maxTokens,
    system: SYSTEM_PROMPT_BASE,
    messages: [
      {
        role: "user",
        content: `Current habits: ${currentHabits.join(", ") || "none yet"}

Suggest 3 high-impact habits I should consider adding, based on what's already tracked. Give each suggestion one sentence of rationale. Format as a numbered list.`,
      },
    ],
  });

  return (message.content[0] as { type: string; text: string }).text;
}
