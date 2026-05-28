import { SYSTEM_PROMPT_BASE } from "../client";
import { getChatConfig } from "../ai-config";
import { chat } from "../provider";
import { shouldMockAI } from "../shared";

interface BriefingContext {
  userName: string;
  habits: Array<{
    name: string;
    streak: number;
    completedToday: boolean;
    category: string;
  }>;
  goals: Array<{
    title: string;
    progress: number;
    status: string;
    dueDate?: string;
  }>;
  todayDate: string;
}

function getMockBriefing(ctx: BriefingContext): string {
  const habitSummary = ctx.habits.length
    ? ctx.habits.map(h => `${h.name} (${h.streak}d streak)`).join(", ")
    : "No habits tracked yet";

  const topGoal = ctx.goals[0]?.title || "No goals set";

  return `Good morning, ${ctx.userName}! 🌟

${ctx.todayDate}

**Your Daily Briefing:**

You're building great momentum with your habits: ${habitSummary}. Keep the streak alive! 🔥

Your top priority today is making progress on "${topGoal}". Even small steps count. Let's focus on what matters most.

**Today's tip:** Start with your most important habit first thing in the morning. It sets the tone for everything else.

You've got this! 💪`;
}

export async function generateDailyBriefing(ctx: BriefingContext): Promise<string> {
  if (shouldMockAI()) return getMockBriefing(ctx);

  try {
    const habitSummary = ctx.habits
      .map((h) => `- ${h.name}: ${h.streak} day streak, ${h.completedToday ? "✅ done today" : "⏳ pending"}`)
      .join("\n");

    const goalSummary = ctx.goals
      .map((g) => `- ${g.title}: ${g.progress}% complete${g.dueDate ? `, due ${g.dueDate}` : ""}`)
      .join("\n");

    return await chat(
      getChatConfig("briefing"),
      SYSTEM_PROMPT_BASE,
      `Generate a personalized daily briefing for ${ctx.userName} for ${ctx.todayDate}.

HABIT DATA:
${habitSummary || "No habits tracked yet."}

GOAL DATA:
${goalSummary || "No goals set yet."}

Write a motivating, insightful morning briefing (3-4 short paragraphs).
- Start with a warm greeting and date
- Highlight key habit streaks or wins
- Surface the most important goal to focus on today
- End with one specific actionable tip for today
- Keep it concise and energizing, not preachy`
    );
  } catch (error) {
    console.log("[BRIEFING] API failed, using mock response:", error instanceof Error ? error.message : "Unknown error");
    return getMockBriefing(ctx);
  }
}
