import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  accountId: z.string().min(1),
  type: z.enum(["income", "expense", "transfer"]),
  amountPaise: z.number().int().positive(),
  category: z.string().min(1),
  date: z.string().datetime(),
  note: z.string().max(500).optional(),
  toAccountId: z.string().optional(), // required for transfer
});

export async function GET() {
  const user = await requireUser();
  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id },
    include: { account: true },
    orderBy: { date: "desc" },
    take: 200,
  });
  return NextResponse.json(transactions);
}

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json() as unknown;
  const result = createSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });
  const data = result.data;

  const account = await prisma.wealthAccount.findFirst({ where: { id: data.accountId, userId: user.id } });
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  if (data.type === "transfer" && !data.toAccountId) {
    return NextResponse.json({ error: "toAccountId required for transfer" }, { status: 400 });
  }

  const transaction = await prisma.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: {
        userId: user.id,
        accountId: data.accountId,
        type: data.type,
        amountPaise: data.amountPaise,
        category: data.category,
        date: new Date(data.date),
        note: data.note,
      },
      include: { account: true },
    });

    if (data.type === "income") {
      await tx.wealthAccount.update({ where: { id: data.accountId }, data: { balancePaise: { increment: data.amountPaise } } });
    } else if (data.type === "expense") {
      await tx.wealthAccount.update({ where: { id: data.accountId }, data: { balancePaise: { decrement: data.amountPaise } } });
    } else if (data.type === "transfer" && data.toAccountId) {
      await tx.wealthAccount.update({ where: { id: data.accountId }, data: { balancePaise: { decrement: data.amountPaise } } });
      await tx.wealthAccount.update({ where: { id: data.toAccountId }, data: { balancePaise: { increment: data.amountPaise } } });
    }

    return created;
  });

  return NextResponse.json(transaction, { status: 201 });
}
