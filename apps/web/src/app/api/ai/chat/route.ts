import { formatDistanceToNow } from "date-fns";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  streamLifeAdvisor,
  aiErrorMessage,
  COACH_HISTORY,
  type ChatTurn,
} from "@secondbrain/ai-core";

const ACTION_START = "<<<ACTIONS>>>";
const ACTION_END = "<<<END_ACTIONS>>>";

// Strip the machine-readable action block before resending an assistant turn to
// the model — it's app plumbing, not conversation, and resending it wastes tokens.
function stripActions(content: string): string {
  const start = content.indexOf(ACTION_START);
  if (start === -1) return content;
  const end = content.indexOf(ACTION_END, start);
  const tail = end === -1 ? "" : content.slice(end + ACTION_END.length);
  return (content.slice(0, start) + tail).trim();
}

/** Hydrate the UI on mount with the user's most recent conversation. */
export async function GET() {
  const user = await requireUser();
  const conversation = await prisma.coachConversation.findFirst({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  return Response.json({
    conversationId: conversation?.id ?? null,
    messages:
      conversation?.messages.map((m) => ({ role: m.role, content: m.content })) ?? [],
  });
}

export async function POST(req: Request) {
  const user = await requireUser();
  const { message, conversationId } = (await req.json()) as {
    message: string;
    conversationId?: string;
  };

  // Resolve (or create) the conversation, scoped to this user.
  let conversation =
    conversationId
      ? await prisma.coachConversation.findFirst({
          where: { id: conversationId, userId: user.id },
        })
      : null;
  if (!conversation) {
    conversation = await prisma.coachConversation.create({
      data: { userId: user.id, title: message.trim().slice(0, 80) },
    });
  }

  // Prior turns to resend to the model — gated and windowed by config to cap tokens.
  let history: ChatTurn[] = [];
  if (COACH_HISTORY.enabled && COACH_HISTORY.maxTurns > 0) {
    const recent = await prisma.coachMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: COACH_HISTORY.maxTurns,
    });
    history = recent
      .reverse()
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.role === "assistant" ? stripActions(m.content) : m.content,
      }));
  }

  // Persist the user's turn (after reading history so it isn't duplicated as a turn).
  await prisma.coachMessage.create({
    data: { conversationId: conversation.id, userId: user.id, role: "user", content: message },
  });

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [goals, skills, journal, habits, habitLogs] = await Promise.all([
    prisma.goal.findMany({ where: { userId: user.id, status: "active" }, take: 10 }),
    prisma.skill.findMany({ where: { userId: user.id }, take: 20 }),
    prisma.journalEntry.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.habit.findMany({ where: { userId: user.id, isActive: true }, orderBy: { updatedAt: "desc" }, take: 20 }),
    prisma.habitLog.findMany({
      where: { userId: user.id, completed: true, date: { gte: sevenDaysAgo } },
      select: { habitId: true },
    }),
  ]);

  const logCounts = habitLogs.reduce<Record<string, number>>((acc, l) => {
    acc[l.habitId] = (acc[l.habitId] ?? 0) + 1;
    return acc;
  }, {});

  const convId = conversation.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let full = "";
      try {
        const generator = streamLifeAdvisor(
          message,
          {
            goals: goals.map((g) => ({ title: g.title, category: g.category, progress: g.progress, status: g.status })),
            skills: skills.map((s) => ({ name: s.name, level: s.level, category: s.category })),
            journal: journal.map((j) => ({
              content: j.content,
              category: j.category,
              when: formatDistanceToNow(j.createdAt, { addSuffix: true }),
            })),
            habits: habits.map((h) => ({
              name: h.name,
              category: h.category,
              frequency: h.frequency,
              completedLast7Days: logCounts[h.id] ?? 0,
            })),
          },
          history
        );

        for await (const chunk of generator) {
          full += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        console.error("[AI CHAT] stream error:", err);
        controller.enqueue(encoder.encode(aiErrorMessage(err)));
      } finally {
        // Persist the assistant turn so the conversation survives a refresh.
        if (full.trim()) {
          try {
            await prisma.coachMessage.create({
              data: { conversationId: convId, userId: user.id, role: "assistant", content: full },
            });
            await prisma.coachConversation.update({
              where: { id: convId },
              data: { updatedAt: new Date() },
            });
          } catch (err) {
            console.error("[AI CHAT] persist error:", err);
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
