import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const patchSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    notes: z.string().max(2000).optional(),
    pillar: z.string().max(50).optional(),
    status: z.enum(["todo", "in_progress", "done"]).optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    scheduledDate: z.coerce.date().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: "No fields to update" });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;

  const task = await prisma.task.findFirst({ where: { id, userId: user.id } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as unknown;
  const result = patchSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });
  }

  const data: Record<string, unknown> = { ...result.data };

  // Stamp completedAt when status is set to done
  if (result.data.status === "done" && !task.completedAt) {
    data.completedAt = new Date();
  } else if (result.data.status && result.data.status !== "done") {
    data.completedAt = null;
  }

  const updated = await prisma.task.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser();
  const { id } = await params;

  const task = await prisma.task.findFirst({ where: { id, userId: user.id } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
