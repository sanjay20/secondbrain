import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { HABIT_TARGET_MAX } from "@/lib/habit-progress";

/**
 * Explicit allow-list. The previous version passed the raw request body into
 * prisma.update, which let a caller rewrite userId, streak, bestStreak or totalDone.
 */
const updateSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  description: z.string().max(200).nullable().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  category: z.string().optional(),
  frequency: z.string().optional(),
  targetCount: z.number().int().min(1).max(HABIT_TARGET_MAX).optional(),
  isActive: z.boolean().optional(),
});

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const habit = await prisma.habit.findFirst({ where: { id, userId: user.id } });
  if (!habit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.habit.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
  }

  const habit = await prisma.habit.findFirst({ where: { id, userId: user.id } });
  if (!habit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.habit.update({ where: { id }, data: parsed.data });
  return NextResponse.json(updated);
}
