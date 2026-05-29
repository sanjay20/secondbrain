import { SYSTEM_PROMPT_BASE } from "../client";
import { getChatConfig } from "../ai-config";
import { chat } from "../provider";
import { shouldMockAI } from "../shared";

interface WealthContext {
  accounts: Array<{ name: string; type: string; balancePaise: number; isLiability: boolean }>;
  recentTransactions: Array<{ type: string; category: string; amountPaise: number; date: string }>;
  investments: Array<{ name: string; investmentType: string; buyPricePaise: number; currentPricePaise: number; units: number }>;
  goals: Array<{ title: string; targetPaise: number; currentPaise: number; targetDate?: string | null }>;
}

function fmt(paise: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
}

function getMockWealthInsights(ctx: WealthContext): string {
  const netWorth = ctx.accounts.reduce((s, a) => s + (a.isLiability ? -a.balancePaise : a.balancePaise), 0);
  return `**Net Worth: ${fmt(netWorth)}**

**Spending:** Your top expense category this month is Food & Dining. Consider a ₹5,000 monthly cap.

**Savings Rate:** Aim for 20% of your income. Even small increases compound significantly over time.

**Investments:** Diversify across equity and debt funds to balance growth and safety.

**Goals:** You're on track for your savings goals. Keep up the consistency!

_(Mock response — set MOCK_AI=false for live AI insights.)_`;
}

export async function getWealthInsights(ctx: WealthContext): Promise<string> {
  if (shouldMockAI()) return getMockWealthInsights(ctx);

  const netWorth = ctx.accounts.reduce((s, a) => s + (a.isLiability ? -a.balancePaise : a.balancePaise), 0);
  const assets = ctx.accounts.filter(a => !a.isLiability).reduce((s, a) => s + a.balancePaise, 0);
  const liabilities = ctx.accounts.filter(a => a.isLiability).reduce((s, a) => s + a.balancePaise, 0);

  const income = ctx.recentTransactions.filter(t => t.type === "income").reduce((s, t) => s + t.amountPaise, 0);
  const expenses = ctx.recentTransactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amountPaise, 0);
  const savingsRate = income > 0 ? Math.round(((income - expenses) / income) * 100) : 0;

  const spendByCategory = ctx.recentTransactions
    .filter(t => t.type === "expense")
    .reduce<Record<string, number>>((acc, t) => { acc[t.category] = (acc[t.category] ?? 0) + t.amountPaise; return acc; }, {});
  const topSpend = Object.entries(spendByCategory).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([cat, amt]) => `  ${cat}: ${fmt(amt)}`).join("\n");

  const totalInvested = ctx.investments.reduce((s, i) => s + i.buyPricePaise * i.units, 0);
  const totalCurrent = ctx.investments.reduce((s, i) => s + i.currentPricePaise * i.units, 0);
  const gainPct = totalInvested > 0 ? Math.round(((totalCurrent - totalInvested) / totalInvested) * 100) : 0;

  const goalSummary = ctx.goals.map(g => {
    const pct = g.targetPaise > 0 ? Math.round((g.currentPaise / g.targetPaise) * 100) : 0;
    const due = g.targetDate ? ` (due ${g.targetDate})` : "";
    return `  "${g.title}": ${fmt(g.currentPaise)} / ${fmt(g.targetPaise)} — ${pct}%${due}`;
  }).join("\n");

  return chat(
    getChatConfig("wealthInsight"),
    SYSTEM_PROMPT_BASE,
    `Here is my financial snapshot for the last 90 days:

NET WORTH: ${fmt(netWorth)} (assets ${fmt(assets)}, liabilities ${fmt(liabilities)})
SAVINGS RATE: ${savingsRate}% (income ${fmt(income)}, expenses ${fmt(expenses)})

TOP SPENDING CATEGORIES:
${topSpend || "  No expense data yet."}

INVESTMENTS: ${fmt(totalInvested)} invested → ${fmt(totalCurrent)} current (${gainPct > 0 ? "+" : ""}${gainPct}%)

SAVINGS GOALS:
${goalSummary || "  No goals set yet."}

Give me concise, actionable insights for each area:
1. Spending — which category to cut and by how much
2. Savings — is my savings rate healthy; one concrete way to improve it
3. Investments — is my allocation balanced; one rebalancing suggestion
4. Goals — which goal needs the most attention and what to do this week

Be specific to my numbers, use INR, and keep each insight to 2-3 sentences.`
  );
}
