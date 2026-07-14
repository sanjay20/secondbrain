import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { HighlightRecap } from "@secondbrain/types";

// Rolling last-7-days recap (timezone-agnostic, deterministic — no AI).
export async function GET() {
  const user = await requireUser();

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);

  const [count, items] = await Promise.all([
    prisma.highlight.count({
      where: { userId: user.id, createdAt: { gte: weekStart } },
    }),
    prisma.highlight.findMany({
      where: { userId: user.id, createdAt: { gte: weekStart } },
      include: { readingItem: { select: { title: true, author: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const recap: HighlightRecap = {
    count,
    weekStart,
    items: items.map((h) => ({
      id: h.id,
      text: h.text,
      sourceTitle: h.readingItem.title,
      sourceAuthor: h.readingItem.author,
      createdAt: h.createdAt,
    })),
  };

  return NextResponse.json(recap);
}
