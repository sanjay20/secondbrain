import { SYSTEM_PROMPT_BASE } from "../client";
import { getChatConfig } from "../ai-config";
import { streamChat, type ChatTurn } from "../provider";
import { shouldMockAI } from "../shared";

// Field shapes reconciled with the actual SB-9 Note (content + pillar, no title) and
// SB-10 Highlight (text + source title, no linked note) models.
export interface KnowledgeQAContext {
  notes: Array<{ id: string; content: string; pillar: string; when: string }>;
  highlights: Array<{ id: string; text: string; source: string; when: string }>;
}

function getMockAnswer(question: string, ctx: KnowledgeQAContext): string {
  const topic = question.trim().slice(0, 80);
  const hasContent = ctx.notes.length > 0 || ctx.highlights.length > 0;

  if (!hasContent) {
    return `I couldn't find anything in your saved notes or highlights that speaks to "${topic}". Save a note or a highlight on this topic first, and I'll be able to answer from it.

_(Mock response — set MOCK_AI=false and add credits for live answers.)_

<<<SOURCES>>>
{"sources":[]}
<<<END_SOURCES>>>`;
  }

  const cited: Array<{ type: "note" | "highlight"; id: string; title: string }> = [];
  const lines: string[] = [];

  const note = ctx.notes[0];
  if (note) {
    cited.push({ type: "note", id: note.id, title: note.content.slice(0, 40) });
    lines.push(`- From your ${note.pillar} note (${note.when}): ${note.content.slice(0, 140)}`);
  }
  const highlight = ctx.highlights[0];
  if (highlight) {
    cited.push({ type: "highlight", id: highlight.id, title: highlight.source });
    lines.push(`- From "${highlight.source}" (${highlight.when}): ${highlight.text.slice(0, 140)}`);
  }

  return `Here's what your saved notes and highlights say about "${topic}":

${lines.join("\n")}

This is grounded strictly in your own saved content — nothing invented.

_(Mock response — set MOCK_AI=false and add credits for live answers.)_

<<<SOURCES>>>
${JSON.stringify({ sources: cited })}
<<<END_SOURCES>>>`;
}

const SOURCES_PROTOCOL = `## Citing your sources
At the very END of every reply, after your normal prose, append a machine-readable block on its own lines listing the notes/highlights you drew on. Use this EXACT format with valid JSON on a single line between the markers:

<<<SOURCES>>>
{"sources":[{"type":"note","id":"…","title":"…"}]}
<<<END_SOURCES>>>

- \`type\` is "note" or "highlight"; \`id\` is the id from the [note:ID] / [highlight:ID] tag of the item you used; \`title\` is a short label (a note snippet or the highlight's source).
- If you could not find any relevant saved content, still include the block with an empty list: {"sources":[]}.
- Keep the JSON minimal and valid. Do not wrap it in code fences.`;

function buildSystemPrompt(ctx: KnowledgeQAContext): string {
  const noteLines = ctx.notes.length
    ? ctx.notes.map((n) => `[note:${n.id}] (${n.pillar}, ${n.when}) ${n.content}`).join("\n")
    : "none saved";
  const highlightLines = ctx.highlights.length
    ? ctx.highlights.map((h) => `[highlight:${h.id}] (from "${h.source}", ${h.when}) ${h.text}`).join("\n")
    : "none saved";

  return `${SYSTEM_PROMPT_BASE}

You are answering the user's questions using ONLY their own saved notes and highlights, listed below. Do not rely on outside knowledge or make up facts. If none of the saved content is relevant to the question, say plainly that you couldn't find anything relevant in their saved notes or highlights — do NOT invent an answer. When you do answer, cite the specific items you used.

USER'S SAVED NOTES:
${noteLines}

USER'S SAVED HIGHLIGHTS:
${highlightLines}

${SOURCES_PROTOCOL}`;
}

export async function* streamKnowledgeQA(
  question: string,
  ctx: KnowledgeQAContext,
  history: ChatTurn[] = []
): AsyncGenerator<string> {
  if (shouldMockAI()) {
    for (const token of getMockAnswer(question, ctx).split(/(\s+)/)) {
      yield token;
    }
    return;
  }

  yield* streamChat(getChatConfig("knowledgeQA"), buildSystemPrompt(ctx), question, history);
}
