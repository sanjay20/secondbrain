import { SYSTEM_PROMPT_BASE } from "../client";
import { getChatConfig } from "../ai-config";
import { chat } from "../provider";
import { shouldMockAI } from "../shared";

interface VisionContext {
  areas: Array<{ name: string; statement: string }>;
  fiveYearGoals: Array<{
    pillar: string;
    goal: string;
    targetYear: number;
    progress: number;
    monthlyTotal: number;
    monthlyDone: number;
  }>;
}

function getMockVisionInsights(ctx: VisionContext): string {
  const count = ctx.areas.length;
  const goalsCount = ctx.fiveYearGoals.length;
  return `Here are your vision board insights (${count} area${count !== 1 ? "s" : ""}, ${goalsCount} 5-year goal${goalsCount !== 1 ? "s" : ""}):

**Recurring themes**: Your vision areas share common threads around growth, intentionality, and long-term fulfilment. These recurring themes suggest a clear sense of direction.

**Alignment**: Your areas appear broadly aligned — they reinforce rather than conflict with each other. That's a strong foundation for focused effort.

**5-Year goal progress**: ${goalsCount > 0 ? `You have ${goalsCount} active 5-year commitment${goalsCount !== 1 ? "s" : ""}. Keep tracking your monthly milestones to ensure steady forward momentum.` : "No 5-year goals set yet — consider adding specific goals for each life pillar to ground your vision in measurable commitments."}

**Motivational note**: Every great life is built from a clear picture of what you want. You've already done the hardest part — articulating your vision. Now it's about consistent daily action toward each area.

_(Mock response — set MOCK_AI=false and add an AI provider key for live insights.)_`;
}

export async function getVisionInsights(ctx: VisionContext): Promise<string> {
  if (shouldMockAI()) return getMockVisionInsights(ctx);

  const areaText = ctx.areas.map((a) => `- ${a.name}: ${a.statement}`).join("\n");

  const goalsText =
    ctx.fiveYearGoals.length > 0
      ? ctx.fiveYearGoals
          .map(
            (g) =>
              `- ${g.pillar} (target ${g.targetYear}): ${g.goal} | progress: ${g.progress}% | monthly: ${g.monthlyDone}/${g.monthlyTotal} done`
          )
          .join("\n")
      : "No 5-year goals set yet.";

  return chat(
    getChatConfig("visionInsight"),
    SYSTEM_PROMPT_BASE,
    `Here are my long-term life vision areas:\n\n${areaText || "No vision areas yet."}\n\n` +
      `Here are my active 5-year goals by life pillar:\n\n${goalsText}\n\n` +
      `Reflect on these: identify recurring themes across areas, note any tension or ` +
      `alignment gaps between them, and comment on alignment and gaps across my 5-year ` +
      `commitments — including whether my progress and monthly follow-through are on track. ` +
      `Give brief motivational commentary. ` +
      `Analyse only what I wrote — do not invent data about other parts of my life. ` +
      `Keep it concise (a few short paragraphs). If there are no areas, encourage me to add my first one.`
  );
}
