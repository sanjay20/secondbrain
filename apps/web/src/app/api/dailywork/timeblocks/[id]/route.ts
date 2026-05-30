import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteEvent } from "@/lib/google";

const patchSchema = z
  .object({
    label: z.string().min(1).max(200).optional(),
    startTime: z.coerce.date().optional(),
    endTime: z.coerce.date().optional(),
    taskId: z.string().nullable().optional(),
    goalId: z.string().nullable().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: "No fields to update" });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;

  const block = await prisma.timeBlock.findFirst({ where: { id, userId: user.id } });
  if (!block) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as unknown;
  const result = patchSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });
  }

  const updated = await prisma.timeBlock.update({
    where: { id },
    data: result.data,
    include: { task: true },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;

  const block = await prisma.timeBlock.findFirst({ where: { id, userId: user.id } });
  if (!block) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Best-effort GCal event deletion
  if (block.googleEventId) {
    try {
      await deleteEvent(user.id, block.googleEventId);
    } catch (err) {
      console.error("[TIMEBLOCKS] GCal delete failed (non-blocking):", err);
    }
  }

  await prisma.timeBlock.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
