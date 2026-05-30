import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PILLARS } from "@secondbrain/types";

const createSchema = z.object({
  pillar: z.enum(PILLARS),
  goal: z.string().min(1).max(300),
  targetYear: z.number().int().min(2024).max(2100).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  notes: z.string().max(2000).optional(),
});

export async function GET(req: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");

  const goals = await prisma.fiveYearGoal.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      monthlyGoals: {
        ...(month ? { where: { month } } : {}),
        orderBy: [{ month: "desc" }, { createdAt: "desc" }],
        take: 200,
      },
    },
  });

  return NextResponse.json(goals);
}

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json() as unknown;
  const result = createSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { pillar, goal, targetYear, progress, notes } = result.data;

  const existing = await prisma.fiveYearGoal.findFirst({
    where: { userId: user.id, pillar, status: "active" },
  });

  if (existing) {
    const pillarLabel = pillar.charAt(0).toUpperCase() + pillar.slice(1);
    return NextResponse.json(
      { error: `Archive your existing ${pillarLabel} goal before adding a new one.` },
      { status: 409 }
    );
  }

  const currentYear = new Date().getFullYear();

  const created = await prisma.fiveYearGoal.create({
    data: {
      userId: user.id,
      pillar,
      goal,
      targetYear: targetYear ?? currentYear + 5,
      progress: progress ?? 0,
      notes,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
