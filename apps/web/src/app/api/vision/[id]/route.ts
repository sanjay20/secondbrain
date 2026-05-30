import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  statement: z.string().min(1).max(2000).optional(),
  emoji: z.string().max(8).optional(),
  color: z.string().max(20).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const existing = await prisma.visionArea.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as unknown;
  const result = patchSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const updated = await prisma.visionArea.update({
    where: { id },
    data: result.data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const existing = await prisma.visionArea.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.visionArea.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
