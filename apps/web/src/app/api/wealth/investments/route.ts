import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  investmentType: z.string().min(1),
  units: z.number().positive().default(1),
  buyPricePaise: z.number().int().nonnegative(),
  currentPricePaise: z.number().int().nonnegative(),
});

export async function GET() {
  const user = await requireUser();
  const investments = await prisma.investment.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(investments);
}

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json() as unknown;
  const result = createSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });
  const investment = await prisma.investment.create({ data: { ...result.data, userId: user.id } });
  return NextResponse.json(investment, { status: 201 });
}
