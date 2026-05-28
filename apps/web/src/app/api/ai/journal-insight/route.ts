import { NextResponse } from "next/server";
import { formatDistanceToNow } from "date-fns";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getJournalFollowups, aiErrorMessage } from "@secondbrain/ai-core";

export async function POST() {
  const user = await requireUser();

  const entries = await prisma.journalEntry.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  try {
    const insight = await getJournalFollowups({
      entries: entries.map((e) => ({
        content: e.content,
        category: e.category,
        mood: e.mood,
        when: formatDistanceToNow(e.createdAt, { addSuffix: true }),
      })),
    });
    return NextResponse.json({ insight });
  } catch (err) {
    console.error("[JOURNAL INSIGHT] error:", err);
    return NextResponse.json({ insight: aiErrorMessage(err) });
  }
}
