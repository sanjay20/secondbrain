import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { startOfDay, subDays } from "date-fns";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTodayDate } from "@/lib/utils";
import {
  SLEEP_NOTE_MAX_LEN,
  SLEEP_PAGE_LIMIT,
  SLEEP_QUALITY_MIN,
  SLEEP_QUALITY_MAX,
  sleepDurationMinutes,
} from "@secondbrain/types";

const createSchema = z
  .object({
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    quality: z.number().int().min(SLEEP_QUALITY_MIN).max(SLEEP_QUALITY_MAX).optional(),
    note: z.string().trim().max(SLEEP_NOTE_MAX_LEN).optional(),
  })
  .refine((d) => new Date(d.endTime) > new Date(d.startTime), {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

export async function GET(req: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const skip = Math.max(0, Number(searchParams.get("skip")) || 0);
  const weekStart = startOfDay(subDays(getTodayDate(), 6));

  const [sleepLogs, weekly, total] = await Promise.all([
    prisma.sleepLog.findMany({
      where: { userId: user.id },
      orderBy: [{ startTime: "desc" }, { createdAt: "desc" }],
      take: SLEEP_PAGE_LIMIT,
      skip,
    }),
    prisma.sleepLog.findMany({
      where: { userId: user.id, startTime: { gte: weekStart } },
    }),
    prisma.sleepLog.count({ where: { userId: user.id } }),
  ]);

  const weeklyCount = weekly.length;
  const weeklyAverageMinutes = weeklyCount
    ? Math.round(
        weekly.reduce((sum, s) => sum + sleepDurationMinutes(s.startTime, s.endTime), 0) /
          weeklyCount,
      )
    : 0;

  return NextResponse.json({ sleepLogs, total, weeklyAverageMinutes, weeklyCount });
}

export async function POST(req: Request) {
  const user = await requireUser();
  const body = (await req.json()) as unknown;

  let data: z.infer<typeof createSchema>;
  try {
    data = createSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    throw err;
  }

  const sleepLog = await prisma.sleepLog.create({
    data: {
      userId: user.id,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
      quality: data.quality,
      note: data.note,
    },
  });

  return NextResponse.json(sleepLog, { status: 201 });
}
