import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { startOfWeek, endOfWeek, parseISO } from "date-fns";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTodayDate } from "@/lib/utils";
import {
  WORKOUT_TYPE_MAX_LEN,
  WORKOUT_NOTES_MAX_LEN,
  WORKOUT_PAGE_LIMIT,
} from "@secondbrain/types";

const createSchema = z.object({
  type: z.string().trim().min(1).max(WORKOUT_TYPE_MAX_LEN),
  duration: z.number().int().positive(),
  notes: z.string().trim().max(WORKOUT_NOTES_MAX_LEN).optional(),
  date: z.string().optional(),
});

// Normalise a yyyy-MM-dd string (or default to today) to a local date-only Date
// so it stores cleanly in the @db.Date column without UTC drift.
function resolveDate(input?: string): Date {
  if (!input) return getTodayDate();
  const parsed = parseISO(input);
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

export async function GET() {
  const user = await requireUser();
  const today = getTodayDate();

  const [workouts, weeklyCount] = await Promise.all([
    prisma.workout.findMany({
      where: { userId: user.id },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: WORKOUT_PAGE_LIMIT,
    }),
    prisma.workout.count({
      where: {
        userId: user.id,
        date: {
          gte: startOfWeek(today, { weekStartsOn: 1 }),
          lte: endOfWeek(today, { weekStartsOn: 1 }),
        },
      },
    }),
  ]);

  return NextResponse.json({ workouts, weeklyCount });
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

  const workout = await prisma.workout.create({
    data: {
      userId: user.id,
      type: data.type,
      duration: data.duration,
      notes: data.notes,
      date: resolveDate(data.date),
    },
  });

  return NextResponse.json(workout, { status: 201 });
}
