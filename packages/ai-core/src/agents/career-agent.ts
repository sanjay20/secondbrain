import { SYSTEM_PROMPT_BASE } from "../client";
import { getChatConfig } from "../ai-config";
import { chat, streamChat, type ChatTurn } from "../provider";
import { shouldMockAI } from "../shared";

export interface CareerContext {
  goals: Array<{
    title: string;
    category: string;
    progress: number;
    status: string;
  }>;
  skills: Array<{ name: string; level: number; category: string }>;
  journal?: Array<{ content: string; category: string; when: string }>;
}

export interface LifeContext extends CareerContext {
  habits?: Array<{
    name: string;
    category: string;
    frequency: string; // "daily" | "weekly"
    completedLast7Days: number; // count of completed HabitLogs in the last 7 days
  }>;
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
  return `Here's how I'd approach that as your life advisor:

1. Clarify the single outcome you want from "${topic}" across your pillars (career, health & habits, knowledge, wealth).
2. Connect it to your habits — small daily wins compound — and to one of your existing goals so it sticks.
3. Pick one concrete action you can finish today, then level up a relevant skill to support it.

A cross-pillar suggestion: pair the goal with a supporting daily habit so progress is automatic.

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

export async function* streamLifeAdvisor(
  userMessage: string,
  ctx: LifeContext,
  history: ChatTurn[] = []
): AsyncGenerator<string> {
  if (shouldMockAI()) {
    for (const token of getMockCoachReply(userMessage).split(/(\s+)/)) {
      yield token;
    }
    return;
  }

  const goalData = ctx.goals.map((g) => `${g.title}: ${g.progress}%`).join(", ");
  const skillData = ctx.skills.map((s) => `${s.name} (L${s.level})`).join(", ");
  const habitData = (ctx.habits ?? [])
    .map((h) => `- ${h.name} (${h.category}, ${h.frequency}): ${h.completedLast7Days}/7 days done last week`)
    .join("\n");
  const journalData = (ctx.journal ?? [])
    .map((j) => `- [${j.when}] (${j.category}) ${j.content}`)
    .join("\n");

  const system = `${SYSTEM_PROMPT_BASE}

You are a holistic life advisor spanning all of the user's life pillars — Career, Health & Habits, Knowledge, and Wealth. Reason across pillars: correlate their habits, goals, skills, and journal so your guidance reflects the whole person, not a single area. When useful, point out how progress (or slippage) in one pillar affects another.

User's habits (Health & Habits pillar):
${habitData || "none tracked"}
User's current goals: ${goalData || "none yet"}
User's skills: ${skillData || "none tracked"}
${journalData ? `\nRecent journal events (most recent first):\n${journalData}\n` : ""}
${ACTION_PROTOCOL}`;

  yield* streamChat(getChatConfig("lifeAdvisor"), system, userMessage, history);
}

// Backward-compatible alias — same signature shape; LifeContext extends CareerContext (NFR-5).
export const streamCareerCoach = streamLifeAdvisor;

const ACTION_PROTOCOL = `## Taking actions in the app
You can add items to the user's app on their behalf: habits (Health & Habits), goals (Career or Knowledge), and skills.

ONLY when the user explicitly asks you to add / save / create / track items, append a machine-readable block at the very END of your reply, after your normal prose. Use this EXACT format with valid JSON on a single line between the markers:

<<<ACTIONS>>>
{"actions":[{"type":"habit","name":"Eat 5 servings of vegetables","category":"health","frequency":"daily"}]}
<<<END_ACTIONS>>>

Field rules:
- habit: name (required), category (one of: health, fitness, mindfulness, learning, productivity, social, general), frequency ("daily" or "weekly"), description (optional).
- goal: title (required), area ("career" or "knowledge"), category (free text, e.g. career/skill/finance/spiritual), priority (low|medium|high|critical), description (optional).
- skill: name (required), area ("career" or "knowledge"), category (free text), level (1-5).

Important:
- Include the block ONLY when the user clearly asks to add/save/track. For normal questions or when just suggesting ideas, do NOT include it.
- Still write a short, friendly confirmation sentence in your prose (e.g. "Adding these 5 habits for you:"). The block is in addition to that.
- Pick sensible categories. Diet, exercise, sleep, hydration → category "health" or "fitness".
- Keep the JSON minimal and valid. Do not wrap it in code fences.`;
