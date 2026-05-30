import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  title: z.string().min(1).max(100),
  targetPaise: z.number().int().positive(),
  currentPaise: z.number().int().nonnegative().default(0),
  targetDate: z.string().datetime().optional(),
  linkedAccountId: z.string().optional(),
});

export async function GET() {
  const user = await requireUser();
  const goals = await prisma.savingsGoal.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(goals);
}

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json() as unknown;
  const result = createSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });
  const data = result.data;
  const goal = await prisma.savingsGoal.create({
    data: { ...data, userId: user.id, targetDate: data.targetDate ? new Date(data.targetDate) : null },
  });
  return NextResponse.json(goal, { status: 201 });
}
