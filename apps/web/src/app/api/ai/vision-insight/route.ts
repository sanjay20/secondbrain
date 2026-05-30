import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getVisionInsights, aiErrorMessage } from "@secondbrain/ai-core";

export async function POST() {
  const user = await requireUser();

  const [areas, fiveYearGoals] = await Promise.all([
    prisma.visionArea.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.fiveYearGoal.findMany({
      where: { userId: user.id, status: "active" },
      include: { monthlyGoals: true },
    }),
  ]);

  const goalContext = fiveYearGoals.map((g) => ({
    pillar: g.pillar,
    goal: g.goal,
    targetYear: g.targetYear,
    progress: g.progress,
    monthlyTotal: g.monthlyGoals.length,
    monthlyDone: g.monthlyGoals.filter((m) => m.status === "done").length,
  }));

  try {
    const insight = await getVisionInsights({
      areas: areas.map((a) => ({ name: a.name, statement: a.statement })),
      fiveYearGoals: goalContext,
    });
    return NextResponse.json({ insight });
  } catch (err) {
    console.error("[VISION INSIGHT] error:", err);
    return NextResponse.json({ insight: aiErrorMessage(err) });
  }
}
