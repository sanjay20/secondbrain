import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const skill = await prisma.skill.findFirst({ where: { id, userId: user.id } });
  if (!skill) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.skill.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
