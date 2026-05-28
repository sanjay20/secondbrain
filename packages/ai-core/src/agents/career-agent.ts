import { SYSTEM_PROMPT_BASE } from "../client";
import { getChatConfig } from "../ai-config";
import { chat, streamChat } from "../provider";
import { shouldMockAI } from "../shared";

interface CareerContext {
  goals: Array<{
    title: string;
    category: string;
    progress: number;
    status: string;
  }>;
  skills: Array<{ name: string; level: number; category: string }>;
}

function getMockCareerInsight(ctx: CareerContext): string {
  const topGoal = ctx.goals[0]?.title ?? "your top goal";
  const topSkill = ctx.skills[0]?.name ?? "a core skill";
  return `**Going well:** You're tracking ${ctx.goals.length} goal(s) and ${ctx.skills.length} skill(s) — that consistency is the foundation of career growth.

**Skill gap:** Consider deepening "${topSkill}" — leveling it up will compound across your goals.

**This week:** Block 90 focused minutes to push "${topGoal}" forward by one concrete milestone.

_(Mock response — set MOCK_AI=false and add Anthropic credits for live insights.)_`;
}

function getMockCoachReply(userMessage: string): string {
  const topic = userMessage.trim().slice(0, 80);
  return `Here's how I'd approach that:

1. Clarify the single outcome you want from "${topic}".
2. Break it into one small action you can finish today.
3. Tie it back to an existing goal or habit so it sticks.

What feels like the most important first step?

_(Mock response — set MOCK_AI=false and add Anthropic credits for live coaching.)_`;
}

export async function getCareerInsights(ctx: CareerContext): Promise<string> {
  if (shouldMockAI()) return getMockCareerInsight(ctx);

  const goalData = ctx.goals
    .map((g) => `- ${g.title} (${g.category}): ${g.progress}% — ${g.status}`)
    .join("\n");

  const skillData = ctx.skills
    .map((s) => `- ${s.name} (${s.category}): level ${s.level}/5`)
    .join("\n");

  return chat(
    getChatConfig("careerInsight"),
    SYSTEM_PROMPT_BASE,
    `Analyze my career progress and give actionable insights:

GOALS:
${goalData || "No goals set yet."}

SKILLS:
${skillData || "No skills tracked yet."}

Provide: 1) one thing going well, 2) one skill gap to address, 3) one concrete next action for this week. Be specific and concise.`
  );
}

export async function* streamCareerCoach(
  userMessage: string,
  ctx: CareerContext
): AsyncGenerator<string> {
  if (shouldMockAI()) {
    for (const token of getMockCoachReply(userMessage).split(/(\s+)/)) {
      yield token;
    }
    return;
  }

  const goalData = ctx.goals.map((g) => `${g.title}: ${g.progress}%`).join(", ");
  const skillData = ctx.skills.map((s) => `${s.name} (L${s.level})`).join(", ");

  const system = `${SYSTEM_PROMPT_BASE}

User's current goals: ${goalData || "none yet"}
User's skills: ${skillData || "none tracked"}`;

  yield* streamChat(getChatConfig("careerCoach"), system, userMessage);
}
