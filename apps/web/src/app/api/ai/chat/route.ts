import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { streamCareerCoach, aiErrorMessage } from "@secondbrain/ai-core";

export async function POST(req: Request) {
  const user = await requireUser();
  const { message } = await req.json() as { message: string };

  const [goals, skills] = await Promise.all([
    prisma.goal.findMany({ where: { userId: user.id, status: "active" }, take: 10 }),
    prisma.skill.findMany({ where: { userId: user.id }, take: 20 }),
  ]);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const generator = streamCareerCoach(message, {
          goals: goals.map((g) => ({ title: g.title, category: g.category, progress: g.progress, status: g.status })),
          skills: skills.map((s) => ({ name: s.name, level: s.level, category: s.category })),
        });

        for await (const chunk of generator) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        console.error("[AI CHAT] stream error:", err);
        controller.enqueue(encoder.encode(aiErrorMessage(err)));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
