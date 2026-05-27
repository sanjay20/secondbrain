import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

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
  const body = await req.json() as Record<string, unknown>;

  const habit = await prisma.habit.findFirst({ where: { id, userId: user.id } });
  if (!habit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.habit.update({ where: { id }, data: body });
  return NextResponse.json(updated);
}
