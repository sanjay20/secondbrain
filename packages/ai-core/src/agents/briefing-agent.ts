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
  tasks: Array<{
    title: string;
    priority: string;
  }>;
  mood: { score: number; note?: string } | null;
  todayDate: string;
}

function getMockBriefing(ctx: BriefingContext): string {
  const habitSummary = ctx.habits.length
    ? ctx.habits.map(h => `${h.name} (${h.streak}d streak)`).join(", ")
    : "No habits tracked yet";

  const focus = ctx.tasks[0]?.title || ctx.goals[0]?.title || "no scheduled priorities";
  const moodLine = ctx.mood
    ? ` You logged a mood of ${ctx.mood.score}/10 today, so pace yourself accordingly.`
    : "";

  return `Good morning, ${ctx.userName}! 🌟 ${ctx.todayDate}. You're building momentum with your habits: ${habitSummary}. Today's main focus is "${focus}" — even small steps count.${moodLine} Tip: tackle your most important item first thing to set the tone for the day. You've got this! 💪`;
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

    const taskSummary = ctx.tasks
      .map((t) => `- ${t.title} (priority: ${t.priority})`)
      .join("\n");

    const moodSummary = ctx.mood
      ? `Mood logged today: ${ctx.mood.score}/10${ctx.mood.note ? ` — "${ctx.mood.note}"` : ""}`
      : "No mood logged today.";

    return await chat(
      getChatConfig("briefing"),
      SYSTEM_PROMPT_BASE,
      `Generate a personalized daily briefing for ${ctx.userName} for ${ctx.todayDate}.

HABIT DATA:
${habitSummary || "No habits tracked yet."}

GOAL DATA:
${goalSummary || "No goals set yet."}

TASK DATA:
${taskSummary || "No tasks scheduled for today."}

MOOD DATA:
${moodSummary}

Write a warm, motivating morning briefing of 3-5 sentences (not paragraphs).
- Greet ${ctx.userName} by first name and acknowledge the day
- Highlight a key habit streak or win
- Call out the top task or goal to focus on today
- Optionally reference today's mood if one was logged
- End with one specific, actionable tip
- Keep it energizing, not preachy. Do not exceed 5 sentences.`
    );
  } catch (error) {
    console.log("[BRIEFING] API failed, using mock response:", error instanceof Error ? error.message : "Unknown error");
    return getMockBriefing(ctx);
  }
}
