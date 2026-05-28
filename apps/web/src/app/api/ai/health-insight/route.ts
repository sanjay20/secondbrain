import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getHabitInsights, aiErrorMessage } from "@secondbrain/ai-core";

export async function POST() {
  const user = await requireUser();

  const habits = await prisma.habit.findMany({
    where: { userId: user.id, isActive: true },
    include: { logs: { where: { completed: true }, take: 30, orderBy: { date: "desc" } } },
  });

  if (habits.length === 0) {
    return NextResponse.json({ insight: "Add some habits first, and I'll analyze your patterns!" });
  }

  try {
    const insight = await getHabitInsights({
      habits: habits.map((h) => ({
        name: h.name,
        category: h.category,
        streak: h.streak,
        bestStreak: h.bestStreak,
        totalDone: h.totalDone,
        completionRate: h.logs.length / 30,
      })),
    });
    return NextResponse.json({ insight });
  } catch (err) {
    console.error("[HEALTH INSIGHT] error:", err);
    return NextResponse.json({ insight: aiErrorMessage(err) });
  }
}
