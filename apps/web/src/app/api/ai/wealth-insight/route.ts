import { NextResponse } from "next/server";
import { subDays } from "date-fns";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getWealthInsights, aiErrorMessage } from "@secondbrain/ai-core";

export async function POST() {
  const user = await requireUser();
  const since = subDays(new Date(), 90);

  const [accounts, transactions, investments, goals] = await Promise.all([
    prisma.wealthAccount.findMany({ where: { userId: user.id } }),
    prisma.transaction.findMany({ where: { userId: user.id, date: { gte: since } }, orderBy: { date: "desc" }, take: 500 }),
    prisma.investment.findMany({ where: { userId: user.id } }),
    prisma.savingsGoal.findMany({ where: { userId: user.id } }),
  ]);

  try {
    const insight = await getWealthInsights({
      accounts: accounts.map(a => ({ name: a.name, type: a.type, balancePaise: a.balancePaise, isLiability: a.isLiability })),
      recentTransactions: transactions.map(t => ({ type: t.type, category: t.category, amountPaise: t.amountPaise, date: t.date.toISOString().slice(0, 10) })),
      investments: investments.map(i => ({ name: i.name, investmentType: i.investmentType, buyPricePaise: i.buyPricePaise, currentPricePaise: i.currentPricePaise, units: i.units })),
      goals: goals.map(g => ({ title: g.title, targetPaise: g.targetPaise, currentPaise: g.currentPaise, targetDate: g.targetDate?.toISOString().slice(0, 10) ?? null })),
    });
    return NextResponse.json({ insight });
  } catch (err) {
    console.error("[WEALTH INSIGHT] error:", err);
    return NextResponse.json({ insight: aiErrorMessage(err) });
  }
}
