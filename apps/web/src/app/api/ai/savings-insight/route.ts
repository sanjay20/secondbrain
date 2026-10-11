import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateSavingsPerspective } from "@secondbrain/ai-core";
import type { SavingsPerspectiveContext } from "@secondbrain/ai-core";
import { aiErrorMessage } from "@secondbrain/ai-core";
import { clampWindowDays, loadSavingsBalance } from "@/lib/savings-data";

export const maxDuration = 60;

/** How many lines of each breakdown the model sees — enough to reason, not a dump. */
const TOP_N = 5;

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const windowDays = clampWindowDays(new URL(req.url).searchParams.get("days"));
    const balance = await loadSavingsBalance(prisma, user.id, windowDays);

    const context: SavingsPerspectiveContext = {
      userName: user.name ?? "there",
      windowDays: balance.windowDays,
      balance: balance.balance,
      earned: balance.earned,
      spent: balance.spent,
      weekEarned: balance.weekEarned,
      weekSpent: balance.weekSpent,
      burnRatePct: balance.burnRatePct,
      cleanDayStreak: balance.cleanDayStreak,
      alertLevel: balance.alert.level,
      topLeaks: balance.leakBreakdown.slice(0, TOP_N).map((l) => ({
        name: l.name,
        credits: l.credits,
        count: l.count,
      })),
      topEarners: balance.earnBreakdown.slice(0, TOP_N).map((e) => ({
        label: e.label,
        credits: e.credits,
        count: e.count,
      })),
      pillars: balance.pillars
        .filter((p) => p.earned > 0 || p.spent > 0)
        .map((p) => ({ pillar: p.pillar, earned: p.earned, spent: p.spent })),
    };

    const output = await generateSavingsPerspective(context);

    return NextResponse.json(output);
  } catch (err) {
    console.error("[SAVINGS INSIGHT] error:", err);
    return NextResponse.json({ error: aiErrorMessage(err) }, { status: 500 });
  }
}
