import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NOTE_PILLARS, NOTE_CONTENT_MAX_LEN } from "@secondbrain/types";

const updateSchema = z.object({
  content: z.string().trim().min(1).max(NOTE_CONTENT_MAX_LEN).optional(),
  pillar: z.enum(NOTE_PILLARS).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const existing = await prisma.note.findFirst({ where: { id, userId: user.id } });
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

  const note = await prisma.note.update({
    where: { id },
    data: {
      ...(data.content !== undefined ? { content: data.content } : {}),
      ...(data.pillar !== undefined ? { pillar: data.pillar } : {}),
    },
  });

  return NextResponse.json(note);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const note = await prisma.note.findFirst({ where: { id, userId: user.id } });
  if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.note.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
