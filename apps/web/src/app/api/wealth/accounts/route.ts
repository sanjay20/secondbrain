import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isLiabilityType } from "@secondbrain/types";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.string().min(1),
  balancePaise: z.number().int().min(0).default(0),
  institution: z.string().max(100).optional(),
  isLiability: z.boolean().optional(),
  originalPrincipalPaise: z.number().int().nonnegative().optional(),
  interestRateBps: z.number().int().nonnegative().optional(),
  emiPaise: z.number().int().nonnegative().optional(),
  tenureMonths: z.number().int().nonnegative().optional(),
  paidMonths: z.number().int().nonnegative().optional(),
  creditLimitPaise: z.number().int().nonnegative().optional(),
  minimumPaymentPaise: z.number().int().nonnegative().optional(),
  isArchived: z.boolean().optional(),
});

export async function GET() {
  const user = await requireUser();
  const accounts = await prisma.wealthAccount.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(accounts);
}

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json() as unknown;
  const result = createSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });
  const data = result.data;

  const account = await prisma.wealthAccount.create({
    data: {
      ...data,
      userId: user.id,
      isLiability: data.isLiability ?? isLiabilityType(data.type),
      paidMonths: data.paidMonths ?? 0,
      isArchived: data.isArchived ?? false,
    },
  });
  return NextResponse.json(account, { status: 201 });
}
