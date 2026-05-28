import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getKnowledgeRecommendations, aiErrorMessage } from "@secondbrain/ai-core";

export async function POST() {
  const user = await requireUser();

  const [goals, skills] = await Promise.all([
    prisma.goal.findMany({ where: { userId: user.id, area: "knowledge" }, take: 15 }),
    prisma.skill.findMany({ where: { userId: user.id, area: "knowledge" }, take: 30 }),
  ]);

  try {
    const insight = await getKnowledgeRecommendations({
      interests: goals.map((g) => ({ title: g.title, category: g.category, progress: g.progress })),
      knowledge: skills.map((s) => ({ name: s.name, category: s.category, level: s.level })),
    });
    return NextResponse.json({ insight });
  } catch (err) {
    console.error("[KNOWLEDGE INSIGHT] error:", err);
    return NextResponse.json({ insight: aiErrorMessage(err) });
  }
}
