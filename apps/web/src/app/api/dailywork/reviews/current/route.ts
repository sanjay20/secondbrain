import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { weekRange } from "@/lib/datetime";
import type { WeeklyReviewContent } from "@secondbrain/types";

export async function GET(req: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const weekStartParam = searchParams.get("weekStart");

  const refDate = weekStartParam ? new Date(weekStartParam) : new Date();
  const tz = user.timezone ?? undefined;
  const range = weekRange(refDate, tz);

  const [tasks, habits, habitLogs, existing] = await Promise.all([
    prisma.task.findMany({
      where: { userId: user.id, scheduledDate: { gte: range.gte, lt: range.lt } },
    }),
    prisma.habit.findMany({ where: { userId: user.id, isActive: true } }),
    prisma.habitLog.findMany({
      where: { userId: user.id, date: { gte: range.gte, lt: range.lt }, completed: true },
    }),
    prisma.weeklyReview.findUnique({
      where: { userId_weekStart: { userId: user.id, weekStart: range.gte } },
    }),
  ]);

  const completedTasks = tasks.filter((t) => t.completedAt !== null).length;
  const totalTasks = tasks.length;

  // Habit completion rate: unique habit-days completed / (active habits * 7 days)
  const possibleHabitDays = habits.length * 7;
  const completedHabitDays = habitLogs.length;
  const habitCompletionRate =
    possibleHabitDays > 0
      ? Math.round((completedHabitDays / possibleHabitDays) * 100)
      : 0;

  const existingContent = (existing?.content as unknown) as WeeklyReviewContent | null | undefined;
  const draft: WeeklyReviewContent = {
    completedTasks,
    totalTasks,
    habitCompletionRate,
    notes: existingContent?.notes ?? "",
    highlights: existingContent?.highlights ?? "",
    improvements: existingContent?.improvements ?? "",
  };

  return NextResponse.json({
    weekStart: range.gte,
    weekEnd: new Date(range.lt.getTime() - 1),
    content: draft,
    saved: !!existing,
  });
}
