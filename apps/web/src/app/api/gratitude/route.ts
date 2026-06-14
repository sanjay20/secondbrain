import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { startOfMonth, endOfMonth, subDays, format, parseISO } from "date-fns";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTodayDate } from "@/lib/utils";
import { GRATITUDE_MAX_PER_DAY, GRATITUDE_ITEM_MAX_LEN } from "@secondbrain/types";

const createSchema = z.object({
  item: z.string().trim().min(1).max(GRATITUDE_ITEM_MAX_LEN),
});

function computeStreak(entryDates: string[], todayKey: string): number {
  const dateSet = new Set(entryDates);
  let streak = 0;
  const startKey = dateSet.has(todayKey)
    ? todayKey
    : format(subDays(parseISO(todayKey), 1), "yyyy-MM-dd");

  let cursor = parseISO(startKey);
  while (true) {
    const key = format(cursor, "yyyy-MM-dd");
    if (!dateSet.has(key)) break;
    streak++;
    cursor = subDays(cursor, 1);
  }
  return streak;
}

export async function GET() {
  const user = await requireUser();
  const today = getTodayDate();
  const todayKey = format(today, "yyyy-MM-dd");

  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const [entries, recentEntries] = await Promise.all([
    prisma.gratitudeEntry.findMany({
      where: { userId: user.id, date: { gte: monthStart, lte: monthEnd } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.gratitudeEntry.findMany({
      where: { userId: user.id, date: { gte: subDays(today, 60) } },
      orderBy: { date: "asc" },
      select: { date: true },
    }),
  ]);

  const distinctDates = [...new Set(recentEntries.map((e) => format(new Date(e.date), "yyyy-MM-dd")))];
  const streak = computeStreak(distinctDates, todayKey);

  return NextResponse.json({ entries, streak });
}

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json() as unknown;

  let data: z.infer<typeof createSchema>;
  try {
    data = createSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    throw err;
  }

  const today = getTodayDate();
  const count = await prisma.gratitudeEntry.count({
    where: { userId: user.id, date: today },
  });

  if (count >= GRATITUDE_MAX_PER_DAY) {
    return NextResponse.json(
      { error: "You've logged your 3 gratitude items for today!" },
      { status: 409 }
    );
  }

  const entry = await prisma.gratitudeEntry.create({
    data: { userId: user.id, item: data.item, date: today },
  });

  return NextResponse.json(entry, { status: 201 });
}
