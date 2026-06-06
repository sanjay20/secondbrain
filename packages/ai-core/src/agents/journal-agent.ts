import { SYSTEM_PROMPT_BASE } from "../client";
import { getChatConfig } from "../ai-config";
import { chat } from "../provider";
import { shouldMockAI } from "../shared";

interface JournalContext {
  entries: Array<{ content: string; category: string; mood?: string | null; when: string }>;
  coreValues?: string[];
}

function getMockJournalFollowups(ctx: JournalContext): string {
  const first = ctx.entries[0]?.content ?? "your recent notes";
  const valuesNote = ctx.coreValues && ctx.coreValues.length
    ? ` (reflecting your core values: ${ctx.coreValues.join(", ")})`
    : "";
  return `Here are some follow-ups based on your journal${valuesNote}:

**${first.slice(0, 60)}**
- ✅ Next step: break it into one concrete action you can take today.
- ⏰ Set a reminder so it doesn't slip.
- 🤝 If others are involved, draft a short message to align with them.

_(Mock response — set MOCK_AI=false and add an API key for live follow-ups.)_`;
}

export async function getJournalFollowups(ctx: JournalContext): Promise<string> {
  if (shouldMockAI()) return getMockJournalFollowups(ctx);

  const valuesBlock = ctx.coreValues && ctx.coreValues.length
    ? `My core values are: ${ctx.coreValues.join(", ")}. Where relevant, reference these values by name when giving advice.\n\n`
    : "";

  const entryData = ctx.entries
    .map((e) => `- [${e.when}] (${e.category}${e.mood ? `, mood: ${e.mood}` : ""}) ${e.content}`)
    .join("\n");

  return chat(
    getChatConfig("journalInsight"),
    SYSTEM_PROMPT_BASE,
    `${valuesBlock}These are key events I logged in my journal recently (most recent first):

${entryData || "No entries yet."}

For the events that need attention, give me practical follow-ups:
- what concrete next action to take and by when,
- how to mitigate any risk or fallout,
- if it's interpersonal or emotional, a calm, constructive suggestion.
Group by event with a short heading. Skip events that are already resolved or need nothing. Be specific and concise. If there are no entries, encourage me to start logging key events.`
  );
}
