import { SYSTEM_PROMPT_BASE } from "../client";
import { getChatConfig } from "../ai-config";
import { chat } from "../provider";
import { shouldMockAI } from "../shared";

interface KnowledgeContext {
  interests: Array<{ title: string; category: string; progress: number }>;
  knowledge: Array<{ name: string; category: string; level: number }>;
}

function getMockKnowledgeRecommendations(ctx: KnowledgeContext): string {
  const topic = ctx.interests[0]?.title ?? "your areas of interest";
  return `**${topic}**
- 📕 Book: "Deep Work" by Cal Newport — sharpens focused learning.
- 🧘 Practice: 10 minutes of daily reflective journaling.
- 🔗 Online: a free introductory course on the topic from a reputable platform.

_(Mock response — set MOCK_AI=false and add an API key for live recommendations.)_`;
}

export async function getKnowledgeRecommendations(ctx: KnowledgeContext): Promise<string> {
  if (shouldMockAI()) return getMockKnowledgeRecommendations(ctx);

  const interestData = ctx.interests
    .map((i) => `- ${i.title} (${i.category}): ${i.progress}% explored`)
    .join("\n");
  const knowledgeData = ctx.knowledge
    .map((k) => `- ${k.name} (${k.category}): level ${k.level}/5`)
    .join("\n");

  return chat(
    getChatConfig("knowledgeInsight"),
    SYSTEM_PROMPT_BASE,
    `I'm growing my knowledge across different areas of life (technical, spiritual, parenting, finance, health, and more).

WHAT I WANT TO LEARN / EXPLORE:
${interestData || "Nothing specified yet."}

WHAT I ALREADY KNOW:
${knowledgeData || "Nothing tracked yet."}

For each area I want to explore, recommend:
1) one or two specific books (with author),
2) one practice or habit I can start this week,
3) one kind of free online resource to look for (course, podcast, community).
Group your answer by area with a short heading. Be concrete and concise. If I haven't specified interests yet, suggest a balanced starter set across technical, spiritual, finance, and parenting.`
  );
}
