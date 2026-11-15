import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTodayDate } from "@/lib/utils";
import { clampCount, countFromLog, targetOf } from "@/lib/habit-progress";

/**
 * Two ways to log, so habits with a target of 1 keep their original contract:
 *   { completed: true | false }  all-or-nothing — fills to the target, or clears it
 *   { delta: 1 | -1 }            one step up or down, for multi-count habits
 */
const logSchema = z.union([
  z.object({ completed: z.boolean() }),
  z.object({ delta: z.union([z.literal(1), z.literal(-1)]) }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const parsed = logSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Expected { completed } or { delta: 1 | -1 }" }, { status: 400 });
  }

  const habit = await prisma.habit.findFirst({ where: { id, userId: user.id } });
  if (!habit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const today = getTodayDate();
  const target = targetOf(habit);

  const existing = await prisma.habitLog.findUnique({
    where: { habitId_date: { habitId: id, date: today } },
  });
  const current = countFromLog(existing, target);

  const next =
    "delta" in parsed.data
      ? clampCount(current + parsed.data.delta, target)
      : parsed.data.completed
        ? target
        : 0;

  const completed = next >= target;

  const log = await prisma.habitLog.upsert({
    where: { habitId_date: { habitId: id, date: today } },
    update: { completed, count: next },
    create: { habitId: id, userId: user.id, date: today, completed, count: next },
  });

  await updateStreak(id, user.id);

  return NextResponse.json({ ...log, target });
}

async function updateStreak(habitId: string, userId: string) {
  const logs = await prisma.habitLog.findMany({
    where: { habitId, userId, completed: true },
    orderBy: { date: "desc" },
    take: 100,
  });

  let streak = 0;
  const today = getTodayDate();

  for (let i = 0; i < logs.length; i++) {
    const logDate = new Date(logs[i].date);
    logDate.setHours(0, 0, 0, 0);

    const expected = new Date(today);
    expected.setDate(today.getDate() - i);

    if (logDate.getTime() === expected.getTime()) {
      streak++;
    } else {
      break;
    }
  }

  const habit = await prisma.habit.findUnique({ where: { id: habitId } });
  // totalDone counts days fully completed, not individual taps — keeping that meaning
  // leaves streaks and the dashboard's "total completions" stat comparable to before.
  await prisma.habit.update({
    where: { id: habitId },
    data: {
      streak,
      bestStreak: Math.max(streak, habit?.bestStreak ?? 0),
      totalDone: logs.length,
    },
  });
}
