import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const tx = await prisma.transaction.findFirst({ where: { id, userId: user.id } });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Reverse balance effect
  await prisma.$transaction(async (p) => {
    await p.transaction.delete({ where: { id } });
    if (tx.type === "income") {
      await p.wealthAccount.update({ where: { id: tx.accountId }, data: { balancePaise: { decrement: tx.amountPaise } } });
    } else if (tx.type === "expense") {
      await p.wealthAccount.update({ where: { id: tx.accountId }, data: { balancePaise: { increment: tx.amountPaise } } });
    }
  });

  return NextResponse.json({ success: true });
}
