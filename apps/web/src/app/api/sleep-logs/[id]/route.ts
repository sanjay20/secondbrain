import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  SLEEP_NOTE_MAX_LEN,
  SLEEP_QUALITY_MIN,
  SLEEP_QUALITY_MAX,
} from "@secondbrain/types";

const updateSchema = z
  .object({
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    quality: z.number().int().min(SLEEP_QUALITY_MIN).max(SLEEP_QUALITY_MAX).nullable().optional(),
    note: z.string().trim().max(SLEEP_NOTE_MAX_LEN).nullable().optional(),
  });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const existing = await prisma.sleepLog.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as unknown;
  let data: z.infer<typeof updateSchema>;
  try {
    data = updateSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    throw err;
  }

  const start = data.startTime ? new Date(data.startTime) : existing.startTime;
  const end = data.endTime ? new Date(data.endTime) : existing.endTime;
  if (end <= start) {
    return NextResponse.json({ error: "endTime must be after startTime" }, { status: 400 });
  }

  const sleepLog = await prisma.sleepLog.update({
    where: { id },
    data: {
      ...(data.startTime !== undefined ? { startTime: start } : {}),
      ...(data.endTime !== undefined ? { endTime: end } : {}),
      ...(data.quality !== undefined ? { quality: data.quality } : {}),
      ...(data.note !== undefined ? { note: data.note } : {}),
    },
  });

  return NextResponse.json(sleepLog);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const sleepLog = await prisma.sleepLog.findFirst({ where: { id, userId: user.id } });
  if (!sleepLog) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.sleepLog.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
