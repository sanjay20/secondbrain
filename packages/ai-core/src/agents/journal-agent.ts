import { SYSTEM_PROMPT_BASE } from "../client";
import { getChatConfig } from "../ai-config";
import { chat } from "../provider";
import { shouldMockAI } from "../shared";

interface JournalContext {
  entries: Array<{ content: string; category: string; mood?: string | null; when: string }>;
}

function getMockJournalFollowups(ctx: JournalContext): string {
  const first = ctx.entries[0]?.content ?? "your recent notes";
  return `Here are some follow-ups based on your journal:

**${first.slice(0, 60)}**
- ✅ Next step: break it into one concrete action you can take today.
- ⏰ Set a reminder so it doesn't slip.
- 🤝 If others are involved, draft a short message to align with them.

_(Mock response — set MOCK_AI=false and add an API key for live follow-ups.)_`;
}

export async function getJournalFollowups(ctx: JournalContext): Promise<string> {
  if (shouldMockAI()) return getMockJournalFollowups(ctx);

  const entryData = ctx.entries
    .map((e) => `- [${e.when}] (${e.category}${e.mood ? `, mood: ${e.mood}` : ""}) ${e.content}`)
    .join("\n");

  return chat(
    getChatConfig("journalInsight"),
    SYSTEM_PROMPT_BASE,
    `These are key events I logged in my journal recently (most recent first):

${entryData || "No entries yet."}

For the events that need attention, give me practical follow-ups:
- what concrete next action to take and by when,
- how to mitigate any risk or fallout,
- if it's interpersonal or emotional, a calm, constructive suggestion.
Group by event with a short heading. Skip events that are already resolved or need nothing. Be specific and concise. If there are no entries, encourage me to start logging key events.`
  );
}
