import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const patchSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  targetPaise: z.number().int().positive().optional(),
  currentPaise: z.number().int().nonnegative().optional(),
  targetDate: z.string().datetime().nullable().optional(),
}).partial();

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const goal = await prisma.savingsGoal.findFirst({ where: { id, userId: user.id } });
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as unknown;
  const result = patchSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });
  const data = result.data;

  const updated = await prisma.savingsGoal.update({
    where: { id },
    data: { ...data, targetDate: data.targetDate !== undefined ? (data.targetDate ? new Date(data.targetDate) : null) : undefined },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const goal = await prisma.savingsGoal.findFirst({ where: { id, userId: user.id } });
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.savingsGoal.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
