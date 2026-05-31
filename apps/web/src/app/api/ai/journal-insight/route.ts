import { NextResponse } from "next/server";
import { formatDistanceToNow } from "date-fns";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getJournalFollowups, aiErrorMessage } from "@secondbrain/ai-core";
import { MAX_CORE_VALUES } from "@secondbrain/types";

export async function POST() {
  const user = await requireUser();

  const [entries, coreValues] = await Promise.all([
    prisma.journalEntry.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.coreValue.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      take: MAX_CORE_VALUES,
    }),
  ]);

  try {
    const insight = await getJournalFollowups({
      entries: entries.map((e) => ({
        content: e.content,
        category: e.category,
        mood: e.mood,
        when: formatDistanceToNow(e.createdAt, { addSuffix: true }),
      })),
      coreValues: coreValues.map((v) => v.name),
    });
    return NextResponse.json({ insight });
  } catch (err) {
    console.error("[JOURNAL INSIGHT] error:", err);
    return NextResponse.json({ insight: aiErrorMessage(err) });
  }
}
