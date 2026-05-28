import { anthropic, SYSTEM_PROMPT_BASE } from "../client";
import { AI_CONFIG } from "../ai-config";

interface CareerContext {
  goals: Array<{
    title: string;
    category: string;
    progress: number;
    status: string;
  }>;
  skills: Array<{ name: string; level: number; category: string }>;
}

export async function getCareerInsights(ctx: CareerContext): Promise<string> {
  const goalData = ctx.goals
    .map((g) => `- ${g.title} (${g.category}): ${g.progress}% — ${g.status}`)
    .join("\n");

  const skillData = ctx.skills
    .map((s) => `- ${s.name} (${s.category}): level ${s.level}/5`)
    .join("\n");

  const message = await anthropic.messages.create({
    model: AI_CONFIG.careerInsight.model,
    max_tokens: AI_CONFIG.careerInsight.maxTokens,
    system: SYSTEM_PROMPT_BASE,
    messages: [
      {
        role: "user",
        content: `Analyze my career progress and give actionable insights:

GOALS:
${goalData || "No goals set yet."}

SKILLS:
${skillData || "No skills tracked yet."}

Provide: 1) one thing going well, 2) one skill gap to address, 3) one concrete next action for this week. Be specific and concise.`,
      },
    ],
  });

  return (message.content[0] as { type: string; text: string }).text;
}

export async function* streamCareerCoach(
  userMessage: string,
  ctx: CareerContext
): AsyncGenerator<string> {
  const goalData = ctx.goals.map((g) => `${g.title}: ${g.progress}%`).join(", ");
  const skillData = ctx.skills.map((s) => `${s.name} (L${s.level})`).join(", ");

  const stream = await anthropic.messages.create({
    model: AI_CONFIG.careerCoach.model,
    max_tokens: AI_CONFIG.careerCoach.maxTokens,
    stream: true,
    system: `${SYSTEM_PROMPT_BASE}

User's current goals: ${goalData || "none yet"}
User's skills: ${skillData || "none tracked"}`,
    messages: [{ role: "user", content: userMessage }],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}
