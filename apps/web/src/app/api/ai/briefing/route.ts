import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateDailyBriefing } from "@secondbrain/ai-core";
import { getTodayDate } from "@/lib/utils";
import { userDayRange } from "@/lib/datetime";
import { format } from "date-fns";

export async function POST() {
  try {
    const user = await requireUser();
    const today = getTodayDate();
    const dayRange = userDayRange(today, user.timezone ?? undefined);

    const [habits, habitLogs, goals, tasks, mood] = await Promise.all([
      prisma.habit.findMany({ where: { userId: user.id, isActive: true } }),
      prisma.habitLog.findMany({ where: { userId: user.id, date: today, completed: true } }),
      prisma.goal.findMany({ where: { userId: user.id, status: "active" } }),
      prisma.task.findMany({
        where: {
          userId: user.id,
          completedAt: null,
          OR: [
            { scheduledDate: { gte: dayRange.gte, lt: dayRange.lt } },
            { rolledOver: true },
          ],
        },
        orderBy: [{ priority: "desc" }, { scheduledDate: "asc" }],
        take: 5,
      }),
      prisma.moodLog.findFirst({ where: { userId: user.id, date: today } }),
    ]);

    const completedIds = new Set(habitLogs.map((l) => l.habitId));

    console.log("[BRIEFING API] Generating briefing for user:", user.id);
    const briefing = await generateDailyBriefing({
      userName: user.name ?? "there",
      todayDate: format(today, "EEEE, MMMM d, yyyy"),
      habits: habits.map((h) => ({
        name: h.name,
        streak: h.streak,
        completedToday: completedIds.has(h.id),
        category: h.category,
      })),
      goals: goals.map((g) => ({
        title: g.title,
        progress: g.progress,
        status: g.status,
        dueDate: g.dueDate ? format(g.dueDate, "MMM d") : undefined,
      })),
      tasks: tasks.map((t) => ({ title: t.title, priority: t.priority })),
      mood: mood ? { score: mood.mood, note: mood.note ?? undefined } : null,
    });
    console.log("[BRIEFING API] Briefing generated successfully");

    await prisma.aiBriefing.upsert({
      where: { userId_date: { userId: user.id, date: today } },
      update: { content: briefing },
      create: { userId: user.id, date: today, content: briefing },
    });

    return NextResponse.json({ briefing });
  } catch (error) {
    console.error("[BRIEFING API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate briefing" },
      { status: 500 }
    );
  }
}
