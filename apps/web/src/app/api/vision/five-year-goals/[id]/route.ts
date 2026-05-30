import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const patchSchema = z.object({
  goal: z.string().min(1).max(300).optional(),
  targetYear: z.number().int().min(2024).max(2100).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  notes: z.string().max(2000).optional(),
  status: z.enum(["active", "archived"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const existing = await prisma.fiveYearGoal.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as unknown;
  const result = patchSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  if (result.data.status === "active" && existing.status === "archived") {
    const conflict = await prisma.fiveYearGoal.findFirst({
      where: { userId: user.id, pillar: existing.pillar, status: "active", id: { not: id } },
    });
    if (conflict) {
      const pillarLabel = existing.pillar.charAt(0).toUpperCase() + existing.pillar.slice(1);
      return NextResponse.json(
        { error: `Archive your existing ${pillarLabel} goal before adding a new one.` },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.fiveYearGoal.update({
    where: { id },
    data: result.data,
    include: { monthlyGoals: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const existing = await prisma.fiveYearGoal.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.fiveYearGoal.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
