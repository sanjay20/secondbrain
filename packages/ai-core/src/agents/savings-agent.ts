import { SYSTEM_PROMPT_BASE } from "../client";
import { getChatConfig } from "../ai-config";
import { chat } from "../provider";
import { shouldMockAI } from "../shared";

/**
 * Life Savings perspective. Reads the ledger — credits earned by keeping to the
 * plan, credits spent on logged leaks — and gives the user a straight read on
 * whether they are building or burning, plus what to actually do about it.
 *
 * Only aggregates and the user's own leak labels reach the model; the free-text
 * notes attached to a leak never leave the database.
 */

export interface SavingsLeakSummary {
  name: string;
  /** Credits this leak drained over the window. */
  credits: number;
  /** How many times it was logged. */
  count: number;
}

export interface SavingsEarnSummary {
  label: string;
  credits: number;
  count: number;
}

export interface SavingsPillarSummary {
  pillar: string;
  earned: number;
  spent: number;
}

export interface SavingsPerspectiveContext {
  userName: string;
  windowDays: number;
  balance: number;
  earned: number;
  spent: number;
  weekEarned: number;
  weekSpent: number;
  burnRatePct: number;
  cleanDayStreak: number;
  alertLevel: string;
  topLeaks: SavingsLeakSummary[];
  topEarners: SavingsEarnSummary[];
  pillars: SavingsPillarSummary[];
}

export interface SavingsPerspectiveOutput {
  /** Two or three sentences of honest read on the balance. */
  verdict: string;
  /** The single leak costing the most, and what it is really costing. */
  biggestLeak: string;
  /** Two to four concrete moves for the week ahead. */
  moves: string[];
}

function getMockPerspective(ctx: SavingsPerspectiveContext): SavingsPerspectiveOutput {
  const leak = ctx.topLeaks[0];
  const earner = ctx.topEarners[0];

  const verdict =
    ctx.balance <= 0
      ? `Over the last ${ctx.windowDays} days you spent everything you built — ${ctx.spent} credits out against ${ctx.earned} in. The plan is sound; the leaks are winning.`
      : ctx.burnRatePct >= 70
        ? `You are holding ${ctx.balance} credits, but ${ctx.burnRatePct}% of last week's earnings leaked back out. That is a burn rate you cannot sustain.`
        : ctx.burnRatePct >= 40
          ? `${ctx.balance} credits banked over ${ctx.windowDays} days, with ${ctx.burnRatePct}% of last week going back out. Solid, but leaking.`
          : `${ctx.balance} credits banked over ${ctx.windowDays} days and only ${ctx.burnRatePct}% leaked last week. The habits are compounding.`;

  const biggestLeak = leak
    ? `"${leak.name}" cost you ${leak.credits} credits across ${leak.count} occurrence(s) — the single largest drain on your balance.`
    : `Nothing logged as a leak in this window. Either it was a clean stretch, or the logging slipped.`;

  const moves: string[] = [];
  if (leak) {
    moves.push(`Pick one trigger for "${leak.name}" and remove it this week — cutting it in half is worth ${Math.round(leak.credits / 2)} credits.`);
  }
  if (earner) {
    moves.push(`"${earner.label}" is your strongest earner at ${earner.credits} credits. Protect that slot before adding anything new.`);
  } else {
    // Nothing earned yet — the ledger has no opinion until something is logged.
    moves.push(`Nothing has paid into the balance yet. Tick off one habit today and the number starts moving.`);
  }
  moves.push(
    ctx.cleanDayStreak > 0
      ? `You are ${ctx.cleanDayStreak} day(s) clean. Name the number out loud each morning — streaks defend themselves once they are visible.`
      : `Target one fully clean day in the next three. One is enough to restart the streak counter.`
  );

  return { verdict, biggestLeak, moves };
}

function trimText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function normalizeMoves(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const moves = value
    .filter((m): m is string => typeof m === "string" && m.trim().length > 0)
    .map((m) => m.trim())
    .slice(0, 4);
  return moves.length > 0 ? moves : fallback;
}

function formatLeaks(leaks: SavingsLeakSummary[]): string {
  if (leaks.length === 0) return "- none logged";
  return leaks
    .map((l) => `- ${l.name}: ${l.credits} credits across ${l.count} occurrence(s)`)
    .join("\n");
}

function formatEarners(earners: SavingsEarnSummary[]): string {
  if (earners.length === 0) return "- nothing logged";
  return earners.map((e) => `- ${e.label}: ${e.credits} credits (${e.count}×)`).join("\n");
}

export async function generateSavingsPerspective(
  ctx: SavingsPerspectiveContext
): Promise<SavingsPerspectiveOutput> {
  if (shouldMockAI()) return getMockPerspective(ctx);

  const prompt = `${ctx.userName} tracks a "Life Savings" ledger: keeping to the habits and plans they set earns credits, and the slips they log ("leaks") spend those credits. Give them a straight, specific read on the last ${ctx.windowDays} days.

BALANCE (last ${ctx.windowDays} days)
- credits earned: ${ctx.earned}
- credits spent on leaks: ${ctx.spent}
- balance: ${ctx.balance}
- alert level the app is showing: ${ctx.alertLevel}

LAST 7 DAYS
- earned: ${ctx.weekEarned}
- spent: ${ctx.weekSpent}
- burn rate (share of earnings that leaked back out): ${ctx.burnRatePct}%
- consecutive days with no leak logged: ${ctx.cleanDayStreak}

WHERE THE SAVINGS WENT (largest leaks first)
${formatLeaks(ctx.topLeaks)}

WHERE THE SAVINGS CAME FROM (largest earners first)
${formatEarners(ctx.topEarners)}

PER PILLAR (earned / spent)
${ctx.pillars.map((p) => `- ${p.pillar}: +${p.earned} / −${p.spent}`).join("\n")}

Rules for your answer:
- Be direct about the numbers. Quote the actual credits. No vague encouragement.
- Treat the leaks as costs, not moral failures. Never shame, lecture, or moralise about what a leak is — the user named these themselves. Judge the cost, never the person.
- If the balance is healthy, say so plainly instead of manufacturing a problem.
- Moves must be small, concrete and doable this week, tied to their real leaks and earners.

Return ONLY valid JSON in exactly this shape:
{"verdict": string (2-3 sentences), "biggestLeak": string (1-2 sentences naming the costliest leak and what it cost), "moves": [string, string, string] (2-4 concrete actions)}
No markdown, no code fences, no prose outside the JSON.`;

  const raw = await chat(getChatConfig("savingsInsight"), SYSTEM_PROMPT_BASE, prompt);

  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned) as Partial<SavingsPerspectiveOutput>;
    const fallback = getMockPerspective(ctx);
    return {
      verdict: trimText(parsed.verdict, fallback.verdict),
      biggestLeak: trimText(parsed.biggestLeak, fallback.biggestLeak),
      moves: normalizeMoves(parsed.moves, fallback.moves),
    };
  } catch {
    // Deterministic fallback so the card always renders something useful.
    return getMockPerspective(ctx);
  }
}
