import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateWeeklyReview } from "@secondbrain/ai-core";
import type { WeeklyReviewContext } from "@secondbrain/ai-core";
import { getTodayDate } from "@/lib/utils";
import { weekRange } from "@/lib/datetime";
import { format } from "date-fns";

export const maxDuration = 60; // NFR-1: Sonnet/Opus weekly synthesis can take 5–15s

export async function POST(req: Request) {
  try {
    const user = await requireUser();

    const body = (await req.json().catch(() => ({}))) as { weekStart?: string };
    const tz = user.timezone ?? undefined;
    const anchor = body.weekStart ? new Date(body.weekStart) : getTodayDate();
    const { gte, lt } = weekRange(anchor, tz); // Mon 00:00 → next Mon 00:00 (UTC), tz-aware
    const weekStart = gte;
    const weekEnd = new Date(lt.getTime() - 1); // inclusive Sun end (same as dailywork reviews route)

    const [habits, habitLogs, tasks, workouts, journals, moodLogs, gratitudeCount, affirmationCount, goals] =
      await Promise.all([
        prisma.habit.findMany({ where: { userId: user.id, isActive: true } }),
        prisma.habitLog.findMany({ where: { userId: user.id, date: { gte, lt }, completed: true } }),
        prisma.task.findMany({ where: { userId: user.id, scheduledDate: { gte, lt } } }),
        prisma.workout.findMany({ where: { userId: user.id, date: { gte, lt } } }),
        prisma.journalEntry.findMany({ where: { userId: user.id, createdAt: { gte, lt } } }),
        prisma.moodLog.findMany({ where: { userId: user.id, date: { gte, lt } } }),
        prisma.gratitudeEntry.count({ where: { userId: user.id, date: { gte, lt } } }),
        prisma.affirmation.count({ where: { userId: user.id, createdAt: { gte, lt } } }),
        prisma.goal.findMany({
          where: { userId: user.id, status: "active" },
          include: { milestones: { where: { completed: true, completedAt: { gte, lt } } } },
        }),
      ]);

    // Habits: per-habit completion count this week; daily habits expect 7, weekly expect 1.
    const completionsByHabit = new Map<string, number>();
    for (const log of habitLogs) {
      completionsByHabit.set(log.habitId, (completionsByHabit.get(log.habitId) ?? 0) + 1);
    }
    const habitsCtx = habits.map((h) => ({
      name: h.name,
      category: h.category,
      completions: completionsByHabit.get(h.id) ?? 0,
      possible: h.frequency === "daily" ? 7 : 1,
      streak: h.streak,
    }));

    // Tasks
    const tasksCtx = {
      completed: tasks.filter((t) => t.completedAt != null).length,
      incomplete: tasks.filter((t) => t.completedAt == null).length,
      rolledOver: tasks.filter((t) => t.rolledOver).length,
    };

    // Journal + knowledge (knowledge derived from category === "knowledge")
    const knowledgeCount = journals.filter((j) => j.category === "knowledge").length;
    const journalMoods = journals
      .map((j) => j.mood)
      .filter((m): m is string => typeof m === "string" && m.length > 0);

    // Vision goals + career split
    const goalsCtx = goals.map((g) => ({ title: g.title, progress: g.progress, status: g.status }));
    const careerCtx = goals
      .filter((g) => g.area === "career")
      .map((g) => ({ title: g.title, progress: g.progress }))
      .concat(
        goals.flatMap((g) =>
          g.milestones.map((m) => ({ title: `Milestone: ${m.title}`, progress: 100 }))
        )
      );

    const context: WeeklyReviewContext = {
      userName: user.name ?? "there",
      weekLabel: `${format(weekStart, "MMM d")}–${format(weekEnd, "d, yyyy")}`,
      habits: habitsCtx,
      tasks: tasksCtx,
      workouts: workouts.map((w) => ({ type: w.type, duration: w.duration })),
      journalCount: journals.length,
      journalMoods,
      moods: moodLogs.map((m) => m.mood),
      gratitudeCount,
      affirmationCount,
      knowledgeCount,
      goals: goalsCtx,
      career: careerCtx,
    };

    const review = await generateWeeklyReview(context);

    const content = review as unknown as Prisma.InputJsonValue;
    await prisma.aiWeeklyReview.upsert({
      where: { userId_weekStart: { userId: user.id, weekStart } },
      update: { content, weekEnd },
      create: { userId: user.id, weekStart, weekEnd, content },
    });

    return NextResponse.json({ review, weekStart, weekEnd });
  } catch (error) {
    console.error("[WEEKLY REVIEW API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate weekly review" },
      { status: 500 }
    );
  }
}
