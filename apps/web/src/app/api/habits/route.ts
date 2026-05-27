import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTodayDate } from "@/lib/utils";

const createSchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().max(200).optional(),
  icon: z.string().default("✅"),
  color: z.string().default("#6366f1"),
  category: z.string().default("general"),
  frequency: z.string().default("daily"),
});

export async function GET() {
  const user = await requireUser();
  const today = getTodayDate();

  const habits = await prisma.habit.findMany({
    where: { userId: user.id, isActive: true },
    include: {
      logs: { where: { date: today } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    habits.map((h) => ({
      ...h,
      logs: undefined,
      completedToday: h.logs.some((l) => l.completed),
    }))
  );
}

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json() as unknown;
  const data = createSchema.parse(body);

  const habit = await prisma.habit.create({
    data: { ...data, userId: user.id },
  });

  return NextResponse.json(habit, { status: 201 });
}
