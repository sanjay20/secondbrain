import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTodayDate } from "@/lib/utils";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { completed } = await req.json() as { completed: boolean };

  const habit = await prisma.habit.findFirst({ where: { id, userId: user.id } });
  if (!habit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const today = getTodayDate();

  const log = await prisma.habitLog.upsert({
    where: { habitId_date: { habitId: id, date: today } },
    update: { completed },
    create: { habitId: id, userId: user.id, date: today, completed },
  });

  await updateStreak(id, user.id);

  return NextResponse.json(log);
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
  await prisma.habit.update({
    where: { id: habitId },
    data: {
      streak,
      bestStreak: Math.max(streak, habit?.bestStreak ?? 0),
      totalDone: logs.length,
    },
  });
}
