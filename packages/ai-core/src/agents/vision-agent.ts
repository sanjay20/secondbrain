import { SYSTEM_PROMPT_BASE } from "../client";
import { getChatConfig } from "../ai-config";
import { chat } from "../provider";
import { shouldMockAI } from "../shared";

interface VisionContext {
  areas: Array<{ name: string; statement: string }>;
}

function getMockVisionInsights(ctx: VisionContext): string {
  const count = ctx.areas.length;
  return `Here are your vision board insights (${count} area${count !== 1 ? "s" : ""}):

**Recurring themes**: Your vision areas share common threads around growth, intentionality, and long-term fulfilment. These recurring themes suggest a clear sense of direction.

**Alignment**: Your areas appear broadly aligned — they reinforce rather than conflict with each other. That's a strong foundation for focused effort.

**Motivational note**: Every great life is built from a clear picture of what you want. You've already done the hardest part — articulating your vision. Now it's about consistent daily action toward each area.

_(Mock response — set MOCK_AI=false and add an AI provider key for live insights.)_`;
}

export async function getVisionInsights(ctx: VisionContext): Promise<string> {
  if (shouldMockAI()) return getMockVisionInsights(ctx);

  const areaText = ctx.areas.map((a) => `- ${a.name}: ${a.statement}`).join("\n");

  return chat(
    getChatConfig("visionInsight"),
    SYSTEM_PROMPT_BASE,
    `Here are my long-term life vision areas:\n\n${areaText || "No vision areas yet."}\n\n` +
      `Reflect on these: identify recurring themes across areas, note any tension or ` +
      `alignment gaps between them, and give brief motivational commentary. ` +
      `Analyse only what I wrote — do not invent data about other parts of my life. ` +
      `Keep it concise (a few short paragraphs). If there are no areas, encourage me to add my first one.`
  );
}
