import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTodayDate } from "@/lib/utils";

const createSchema = z.object({
  mood: z.number().int().min(1).max(5),
  note: z.string().max(500).optional(),
});

export async function GET() {
  const user = await requireUser();
  const logs = await prisma.moodLog.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
    take: 30,
  });
  return NextResponse.json(logs);
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
  const log = await prisma.moodLog.upsert({
    where: { userId_date: { userId: user.id, date: today } },
    update: { mood: data.mood, note: data.note ?? null },
    create: { userId: user.id, date: today, mood: data.mood, note: data.note ?? null },
  });

  return NextResponse.json(log, { status: 201 });
}
