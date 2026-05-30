import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { userDayRange } from "@/lib/datetime";
import { createEvent } from "@/lib/google";

const createSchema = z
  .object({
    label: z.string().min(1).max(200),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    taskId: z.string().optional(),
    goalId: z.string().optional(),
  })
  .refine((obj) => obj.startTime < obj.endTime, {
    message: "startTime must be before endTime",
    path: ["startTime"],
  });

export async function GET(req: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");

  const date = dateParam ? new Date(dateParam) : new Date();
  const tz = user.timezone ?? undefined;
  const range = userDayRange(date, tz);

  const blocks = await prisma.timeBlock.findMany({
    where: {
      userId: user.id,
      startTime: { gte: range.gte, lt: range.lt },
    },
    include: { task: true },
    orderBy: { startTime: "asc" },
  });

  return NextResponse.json(blocks);
}

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json() as unknown;
  const result = createSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });
  }

  const { label, startTime, endTime, taskId, goalId } = result.data;

  // Check for overlapping blocks (same user, same day)
  const overlapping = await prisma.timeBlock.findFirst({
    where: {
      userId: user.id,
      OR: [
        { startTime: { lt: endTime }, endTime: { gt: startTime } },
      ],
    },
  });
  const conflict = !!overlapping;

  // Optionally push to Google Calendar
  let googleEventId: string | undefined;
  const calConn = await prisma.calendarConnection.findUnique({
    where: { userId: user.id },
  });
  if (calConn) {
    try {
      googleEventId = await createEvent(user.id, { label, startTime, endTime });
    } catch (err) {
      console.error("[TIMEBLOCKS] GCal push failed (non-blocking):", err);
    }
  }

  const block = await prisma.timeBlock.create({
    data: {
      userId: user.id,
      label,
      startTime,
      endTime,
      taskId: taskId ?? null,
      goalId: goalId ?? null,
      googleEventId: googleEventId ?? null,
    },
    include: { task: true },
  });

  return NextResponse.json({ ...block, conflict }, { status: 201 });
}
