import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;

  const goal = await prisma.goal.findFirst({ where: { id, userId: user.id } });
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.goal.update({
    where: { id },
    data: {
      ...body,
      completedAt: body.status === "completed" ? new Date() : goal.completedAt,
    },
    include: { milestones: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const goal = await prisma.goal.findFirst({ where: { id, userId: user.id } });
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.goal.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
