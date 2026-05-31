import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BUCKET_LIST_CATEGORIES } from "@secondbrain/types";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  category: z.enum(BUCKET_LIST_CATEGORIES).optional(),
  notes: z.string().max(2000).optional(),
  completed: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const existing = await prisma.bucketListItem.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as unknown;
  const result = patchSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { completed, ...fields } = result.data;

  const completedAt =
    completed === true ? new Date() :
    completed === false ? null :
    undefined;

  const updated = await prisma.bucketListItem.update({
    where: { id },
    data: {
      ...fields,
      ...(completedAt !== undefined ? { completedAt } : {}),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const existing = await prisma.bucketListItem.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.bucketListItem.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
