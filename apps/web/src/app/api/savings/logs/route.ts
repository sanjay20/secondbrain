import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LEAK_LOG_PAGE_LIMIT } from "@secondbrain/types";
import { buildDayFrames } from "@/lib/life-savings";
import { clampWindowDays } from "@/lib/savings-data";

/** Recent leak occurrences, newest first — the "what did I spend it on" feed. */
export async function GET(req: Request) {
  const user = await requireUser();
  const windowDays = clampWindowDays(new URL(req.url).searchParams.get("days"));
  const windowStart = buildDayFrames(windowDays)[0].start;

  const logs = await prisma.savingsLeakLog.findMany({
    where: { userId: user.id, date: { gte: windowStart } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: LEAK_LOG_PAGE_LIMIT,
    include: {
      leak: { select: { id: true, name: true, icon: true, category: true, pillar: true } },
    },
  });

  return NextResponse.json(logs);
}
