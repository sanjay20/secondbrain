import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const LIABILITY_TYPES = new Set(["loan", "credit_card"]);

const createSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.string().min(1),
  balancePaise: z.number().int().default(0),
  institution: z.string().max(100).optional(),
  isLiability: z.boolean().optional(),
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
      isLiability: data.isLiability ?? LIABILITY_TYPES.has(data.type),
    },
  });
  return NextResponse.json(account, { status: 201 });
}
