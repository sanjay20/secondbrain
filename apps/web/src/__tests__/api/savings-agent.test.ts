/**
 * Unit tests for savings-agent (MOCK_AI=true).
 *
 * Verifies that generateSavingsPerspective produces a usable offline read of
 * the Life Savings ledger for every shape of ledger, without hitting a real AI
 * API. The mock path doubles as the parse-failure fallback in production, so
 * these are the guarantees the card renders against either way.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type {
  SavingsPerspectiveContext,
  SavingsPerspectiveOutput,
} from "@secondbrain/ai-core";

describe("savings-agent — mock AI responses (MOCK_AI=true)", () => {
  let generateSavingsPerspective: (
    ctx: SavingsPerspectiveContext
  ) => Promise<SavingsPerspectiveOutput>;

  beforeEach(async () => {
    process.env.MOCK_AI = "true";
    const mod = await import("@secondbrain/ai-core");
    generateSavingsPerspective =
      mod.generateSavingsPerspective as typeof generateSavingsPerspective;
  });

  afterEach(() => {
    delete process.env.MOCK_AI;
  });

  function context(overrides: Partial<SavingsPerspectiveContext> = {}): SavingsPerspectiveContext {
    return {
      userName: "Sanjay",
      windowDays: 90,
      balance: 1240,
      earned: 1800,
      spent: 560,
      weekEarned: 210,
      weekSpent: 40,
      burnRatePct: 19,
      cleanDayStreak: 4,
      alertLevel: "healthy",
      topLeaks: [
        { name: "Slept late", credits: 240, count: 12 },
        { name: "Doomscrolling", credits: 120, count: 8 },
      ],
      topEarners: [
        { label: "Habit completed", credits: 900, count: 90 },
        { label: "Planned task done", credits: 400, count: 80 },
      ],
      pillars: [
        { pillar: "health", earned: 800, spent: 240 },
        { pillar: "personal", earned: 600, spent: 320 },
      ],
      ...overrides,
    };
  }

  function assertShape(output: SavingsPerspectiveOutput) {
    expect(output.verdict.length).toBeGreaterThan(0);
    expect(output.biggestLeak.length).toBeGreaterThan(0);
    expect(output.moves.length).toBeGreaterThanOrEqual(2);
    expect(output.moves.length).toBeLessThanOrEqual(4);
    for (const text of [output.verdict, output.biggestLeak, ...output.moves]) {
      expect(text).not.toMatch(/undefined|NaN|\[object Object\]/);
    }
  }

  it("returns a complete perspective for a healthy ledger", async () => {
    const output = await generateSavingsPerspective(context());
    assertShape(output);
    expect(output.verdict).toContain("1240");
  });

  it("names the costliest leak and what it cost", async () => {
    const output = await generateSavingsPerspective(context());
    expect(output.biggestLeak).toContain("Slept late");
    expect(output.biggestLeak).toContain("240");
  });

  it("calls out an unsustainable burn rate", async () => {
    const output = await generateSavingsPerspective(
      context({ burnRatePct: 85, weekEarned: 200, weekSpent: 170, alertLevel: "critical" })
    );
    assertShape(output);
    expect(output.verdict).toContain("85%");
  });

  it("is direct when the balance is spent", async () => {
    const output = await generateSavingsPerspective(
      context({ balance: 0, earned: 600, spent: 600, alertLevel: "critical" })
    );
    assertShape(output);
    expect(output.verdict).toContain("600");
  });

  it("handles a ledger with no leaks logged at all", async () => {
    const output = await generateSavingsPerspective(
      context({ topLeaks: [], spent: 0, weekSpent: 0, burnRatePct: 0 })
    );
    assertShape(output);
    expect(output.biggestLeak.length).toBeGreaterThan(0);
  });

  it("handles a brand-new account with nothing logged", async () => {
    const output = await generateSavingsPerspective(
      context({
        balance: 0,
        earned: 0,
        spent: 0,
        weekEarned: 0,
        weekSpent: 0,
        burnRatePct: 0,
        cleanDayStreak: 0,
        topLeaks: [],
        topEarners: [],
        pillars: [],
      })
    );
    assertShape(output);
  });

  it("acknowledges a running clean streak", async () => {
    const output = await generateSavingsPerspective(context({ cleanDayStreak: 9 }));
    expect(output.moves.join(" ")).toContain("9");
  });

  it("asks for a first clean day when the streak is broken", async () => {
    const output = await generateSavingsPerspective(context({ cleanDayStreak: 0 }));
    expect(output.moves.join(" ").toLowerCase()).toContain("clean");
  });
});
