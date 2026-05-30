import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { userDayRange } from "@/lib/datetime";
import { getDayPlan, getEndOfDaySummary, aiErrorMessage } from "@secondbrain/ai-core";

const requestSchema = z.object({
  mode: z.enum(["plan", "summary"]).default("plan"),
});

export async function POST(req: Request) {
  const user = await requireUser();

  const body = await req.json() as unknown;
  const parsed = requestSchema.safeParse(body);
  const mode = parsed.success ? parsed.data.mode : "plan";

  const tz = user.timezone ?? undefined;
  const now = new Date();
  const range = userDayRange(now, tz);

  try {
    if (mode === "plan") {
      const [tasks, goals, habits] = await Promise.all([
        prisma.task.findMany({
          where: {
            userId: user.id,
            completedAt: null,
            OR: [
              { scheduledDate: { gte: range.gte, lt: range.lt } },
              { rolledOver: true },
            ],
          },
          orderBy: [{ priority: "desc" }, { scheduledDate: "asc" }],
          take: 20,
        }),
        prisma.goal.findMany({
          where: { userId: user.id, status: "active" },
          orderBy: { priority: "desc" },
          take: 5,
        }),
        prisma.habit.findMany({
          where: { userId: user.id, isActive: true },
          take: 10,
        }),
      ]);

      const result = await getDayPlan({
        tasks: tasks.map((t) => ({
          id: t.id,
          title: t.title,
          pillar: t.pillar,
          priority: t.priority,
          scheduledDate: t.scheduledDate.toISOString().slice(0, 10),
        })),
        goals: goals.map((g) => ({
          title: g.title,
          status: g.status,
          priority: g.priority,
          progress: g.progress,
        })),
        habits: habits.map((h) => ({ name: h.name, streak: h.streak })),
      });

      return NextResponse.json(result);
    } else {
      // summary mode
      const [completedToday, pendingToday, habits, habitLogsToday] = await Promise.all([
        prisma.task.findMany({
          where: { userId: user.id, completedAt: { gte: range.gte, lt: range.lt } },
          take: 20,
        }),
        prisma.task.findMany({
          where: {
            userId: user.id,
            completedAt: null,
            OR: [
              { scheduledDate: { gte: range.gte, lt: range.lt } },
              { rolledOver: true },
            ],
          },
          take: 20,
        }),
        prisma.habit.findMany({ where: { userId: user.id, isActive: true }, take: 20 }),
        prisma.habitLog.findMany({
          where: { userId: user.id, date: { gte: range.gte, lt: range.lt }, completed: true },
        }),
      ]);

      const summary = await getEndOfDaySummary({
        completedTasks: completedToday.map((t) => ({ title: t.title, pillar: t.pillar })),
        pendingTasks: pendingToday.map((t) => ({ title: t.title, priority: t.priority })),
        completedHabits: habitLogsToday.length,
        totalHabits: habits.length,
      });

      return NextResponse.json({ summary });
    }
  } catch (err) {
    console.error("[DAYPLAN INSIGHT] error:", err);
    return NextResponse.json({ error: aiErrorMessage(err) }, { status: 500 });
  }
}
