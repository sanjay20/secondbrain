import { formatDistanceToNow } from "date-fns";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  streamKnowledgeQA,
  aiErrorMessage,
  KNOWLEDGE_QA_HISTORY,
  type ChatTurn,
  type KnowledgeQAContext,
} from "@secondbrain/ai-core";

// How many of the user's most-recent notes/highlights to stuff into the prompt.
// v1 retrieval is recency-bounded context-stuffing (no vector search).
const CONTEXT_LIMIT = 50;

const SOURCES_START = "<<<SOURCES>>>";
const SOURCES_END = "<<<END_SOURCES>>>";

const EMPTY_STATE_MESSAGE =
  "You haven't saved any notes or highlights yet, so there's nothing for me to search. " +
  "Add a few notes or save some highlights first, then ask me anything about them.";

// Strip the machine-readable sources block before resending an assistant turn to
// the model — it's app plumbing, not conversation, and resending it wastes tokens.
function stripSources(content: string): string {
  const start = content.indexOf(SOURCES_START);
  if (start === -1) return content;
  const end = content.indexOf(SOURCES_END, start);
  const tail = end === -1 ? "" : content.slice(end + SOURCES_END.length);
  return (content.slice(0, start) + tail).trim();
}

// Pull the raw JSON payload out of the sources block, if present and well-formed.
function extractSourcesJson(content: string): string | null {
  const start = content.indexOf(SOURCES_START);
  if (start === -1) return null;
  const end = content.indexOf(SOURCES_END, start);
  if (end === -1) return null;
  const json = content.slice(start + SOURCES_START.length, end).trim();
  try {
    JSON.parse(json);
    return json;
  } catch {
    return null;
  }
}

/** Hydrate the UI on mount with the user's most recent Q&A conversation. */
export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [conversation, noteCount, highlightCount] = await Promise.all([
    prisma.knowledgeConversation.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.note.count({ where: { userId: user.id } }),
    prisma.highlight.count({ where: { userId: user.id } }),
  ]);

  return Response.json({
    conversationId: conversation?.id ?? null,
    messages:
      conversation?.messages.map((m) => ({ role: m.role, content: m.content, sources: m.sources })) ?? [],
    hasKnowledge: noteCount + highlightCount > 0,
  });
}

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message, conversationId } = (await req.json()) as {
    message: string;
    conversationId?: string;
  };

  // Fetch the user's saved knowledge, scoped to userId (NFR-1 / AC-6).
  const [notes, highlights] = await Promise.all([
    prisma.note.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: CONTEXT_LIMIT,
    }),
    prisma.highlight.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: CONTEXT_LIMIT,
      include: { readingItem: { select: { title: true } } },
    }),
  ]);

  const encoder = new TextEncoder();

  // Empty-state guard (FR-6 / AC-4): nothing saved → friendly message, no
  // conversation created, no AI call.
  if (notes.length === 0 && highlights.length === 0) {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(EMPTY_STATE_MESSAGE));
        controller.close();
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  // Resolve (or create) the conversation, scoped to this user.
  let conversation =
    conversationId
      ? await prisma.knowledgeConversation.findFirst({
          where: { id: conversationId, userId: user.id },
        })
      : null;
  if (!conversation) {
    conversation = await prisma.knowledgeConversation.create({
      data: { userId: user.id, title: message.trim().slice(0, 80) },
    });
  }

  // Prior turns to resend to the model — gated and windowed by config to cap tokens.
  let history: ChatTurn[] = [];
  if (KNOWLEDGE_QA_HISTORY.enabled && KNOWLEDGE_QA_HISTORY.maxTurns > 0) {
    const recent = await prisma.knowledgeMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: KNOWLEDGE_QA_HISTORY.maxTurns,
    });
    history = recent
      .reverse()
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.role === "assistant" ? stripSources(m.content) : m.content,
      }));
  }

  // Persist the user's turn (after reading history so it isn't duplicated as a turn).
  await prisma.knowledgeMessage.create({
    data: { conversationId: conversation.id, userId: user.id, role: "user", content: message },
  });

  const ctx: KnowledgeQAContext = {
    notes: notes.map((n) => ({
      id: n.id,
      content: n.content,
      pillar: n.pillar,
      when: formatDistanceToNow(n.createdAt, { addSuffix: true }),
    })),
    highlights: highlights.map((h) => ({
      id: h.id,
      text: h.text,
      source: h.readingItem.title,
      when: formatDistanceToNow(h.createdAt, { addSuffix: true }),
    })),
  };

  const convId = conversation.id;

  const stream = new ReadableStream({
    async start(controller) {
      let full = "";
      try {
        for await (const chunk of streamKnowledgeQA(message, ctx, history)) {
          full += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        console.error("[KNOWLEDGE QA] stream error:", err);
        controller.enqueue(encoder.encode(aiErrorMessage(err)));
      } finally {
        if (full.trim()) {
          try {
            await prisma.knowledgeMessage.create({
              data: {
                conversationId: convId,
                userId: user.id,
                role: "assistant",
                content: full,
                sources: extractSourcesJson(full),
              },
            });
            await prisma.knowledgeConversation.update({
              where: { id: convId },
              data: { updatedAt: new Date() },
            });
          } catch (err) {
            console.error("[KNOWLEDGE QA] persist error:", err);
          }
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Conversation-Id": convId,
    },
  });
}
