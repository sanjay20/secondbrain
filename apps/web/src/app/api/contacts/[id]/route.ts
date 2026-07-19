import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CONTACT_NAME_MAX_LEN, CONTACT_NOTES_MAX_LEN } from "@secondbrain/types";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(CONTACT_NAME_MAX_LEN).optional(),
  relationshipType: z.string().trim().min(1).max(50).optional(),
  notes: z.string().max(CONTACT_NOTES_MAX_LEN).optional(),
  lastInteractionAt: z.string().datetime().optional(),
  logInteraction: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const existing = await prisma.contact.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as unknown;

  let data: z.infer<typeof patchSchema>;
  try {
    data = patchSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    throw err;
  }

  const { logInteraction, lastInteractionAt, ...fields } = data;

  const resolvedInteractionAt =
    logInteraction === true ? new Date() :
    lastInteractionAt !== undefined ? new Date(lastInteractionAt) :
    undefined;

  const updated = await prisma.contact.update({
    where: { id },
    data: {
      ...fields,
      ...(resolvedInteractionAt !== undefined ? { lastInteractionAt: resolvedInteractionAt } : {}),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const existing = await prisma.contact.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.contact.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
