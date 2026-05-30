import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  balancePaise: z.number().int().min(0).optional(),
  institution: z.string().max(100).optional(),
  originalPrincipalPaise: z.number().int().nonnegative().optional(),
  interestRateBps: z.number().int().nonnegative().optional(),
  emiPaise: z.number().int().nonnegative().optional(),
  tenureMonths: z.number().int().nonnegative().optional(),
  paidMonths: z.number().int().nonnegative().optional(),
  creditLimitPaise: z.number().int().nonnegative().optional(),
  minimumPaymentPaise: z.number().int().nonnegative().optional(),
  isArchived: z.boolean().optional(),
}).refine((obj) => Object.keys(obj).length > 0, { message: "No fields to update" });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const account = await prisma.wealthAccount.findFirst({ where: { id, userId: user.id } });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as unknown;
  const result = patchSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });

  const updated = await prisma.wealthAccount.update({ where: { id }, data: result.data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const account = await prisma.wealthAccount.findFirst({ where: { id, userId: user.id } });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.wealthAccount.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
