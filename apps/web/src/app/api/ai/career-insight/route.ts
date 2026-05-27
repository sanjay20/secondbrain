import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCareerInsights } from "@secondbrain/ai-core";

export async function POST() {
  const user = await requireUser();

  const [goals, skills] = await Promise.all([
    prisma.goal.findMany({ where: { userId: user.id } }),
    prisma.skill.findMany({ where: { userId: user.id } }),
  ]);

  if (goals.length === 0 && skills.length === 0) {
    return NextResponse.json({ insight: "Add some goals and skills first, and I'll provide personalized career insights!" });
  }

  const insight = await getCareerInsights({
    goals: goals.map((g) => ({ title: g.title, category: g.category, progress: g.progress, status: g.status })),
    skills: skills.map((s) => ({ name: s.name, level: s.level, category: s.category })),
  });

  return NextResponse.json({ insight });
}
