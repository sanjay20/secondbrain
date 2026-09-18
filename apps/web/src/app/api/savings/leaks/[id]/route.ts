import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  LEAK_CATEGORIES,
  LEAK_COST_MAX,
  LEAK_COST_MIN,
  LEAK_DESCRIPTION_MAX_LEN,
  LEAK_ICON_MAX_LEN,
  LEAK_NAME_MAX_LEN,
  PILLARS,
} from "@secondbrain/types";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(LEAK_NAME_MAX_LEN).optional(),
  description: z.string().trim().max(LEAK_DESCRIPTION_MAX_LEN).optional(),
  icon: z.string().trim().min(1).max(LEAK_ICON_MAX_LEN).optional(),
  category: z.enum(LEAK_CATEGORIES).optional(),
  pillar: z.enum(PILLARS).optional(),
  cost: z.number().int().min(LEAK_COST_MIN).max(LEAK_COST_MAX).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const existing = await prisma.savingsLeak.findFirst({ where: { id, userId: user.id } });
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

  // Re-pricing only affects future logs: past occurrences keep the cost they
  // were logged at, so editing the catalog never rewrites the balance history.
  const updated = await prisma.savingsLeak.update({ where: { id }, data });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const existing = await prisma.savingsLeak.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Cascades to its logs — deleting a leak erases the history it caused too.
  await prisma.savingsLeak.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
