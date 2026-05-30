import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getVisionInsights, aiErrorMessage } from "@secondbrain/ai-core";

export async function POST() {
  const user = await requireUser();

  const areas = await prisma.visionArea.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  try {
    const insight = await getVisionInsights({
      areas: areas.map((a) => ({ name: a.name, statement: a.statement })),
    });
    return NextResponse.json({ insight });
  } catch (err) {
    console.error("[VISION INSIGHT] error:", err);
    return NextResponse.json({ insight: aiErrorMessage(err) });
  }
}
