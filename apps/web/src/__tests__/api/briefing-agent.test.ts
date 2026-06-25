/**
 * Unit tests for briefing-agent (MOCK_AI=true).
 * Verifies that generateDailyBriefing returns correct mock output for various
 * BriefingContext shapes without hitting any real AI API.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("briefing-agent — mock AI responses (MOCK_AI=true)", () => {
  let generateDailyBriefing: (
    input: Parameters<typeof import("@secondbrain/ai-core")["generateDailyBriefing"]>[0]
  ) => Promise<string>;

  beforeEach(async () => {
    process.env.MOCK_AI = "true";
    const mod = await import("@secondbrain/ai-core");
    generateDailyBriefing = mod.generateDailyBriefing as typeof generateDailyBriefing;
  });

  afterEach(() => {
    delete process.env.MOCK_AI;
  });

  const fullContext = {
    userName: "Sanjay",
    todayDate: "Thursday, June 26, 2026",
    habits: [
      { name: "Morning run", streak: 7, completedToday: true, category: "health" },
    ],
    goals: [
      { title: "Ship SecondBrain v1", progress: 60, status: "active", dueDate: "Jul 31" },
    ],
    tasks: [
      { title: "Write briefing tests", priority: "high" },
      { title: "Review PR", priority: "medium" },
    ],
    mood: { score: 8, note: "Feeling focused" },
  };

  const emptyContext = {
    userName: "Sanjay",
    todayDate: "Thursday, June 26, 2026",
    habits: [],
    goals: [],
    tasks: [],
    mood: null,
  };

  // ── Full context ─────────────────────────────────────────────────────────────

  it("returns a non-empty string for full context", async () => {
    const result = await generateDailyBriefing(fullContext);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("mentions the first task title in full context output", async () => {
    const result = await generateDailyBriefing(fullContext);
    // The mock picks tasks[0].title as the focus item
    expect(result).toMatch(/Write briefing tests/i);
  });

  it("mentions the mood score in full context output", async () => {
    const result = await generateDailyBriefing(fullContext);
    // The mock includes a mood sentence referencing the score
    expect(result).toMatch(/8/);
  });

  it("includes the user's name in full context output", async () => {
    const result = await generateDailyBriefing(fullContext);
    expect(result).toMatch(/Sanjay/);
  });

  // ── Empty context ────────────────────────────────────────────────────────────

  it("returns a string and does not throw for empty context", async () => {
    let result: string | undefined;
    let threw = false;
    try {
      result = await generateDailyBriefing(emptyContext);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(typeof result).toBe("string");
    expect((result as string).length).toBeGreaterThan(0);
  });

  it("does not produce 'undefined' in the output for empty context", async () => {
    const result = await generateDailyBriefing(emptyContext);
    expect(result).not.toMatch(/undefined/);
  });

  // ── mood: null ───────────────────────────────────────────────────────────────

  it("does not produce 'undefined' when mood is null", async () => {
    const result = await generateDailyBriefing({
      ...fullContext,
      mood: null,
    });
    expect(result).not.toMatch(/undefined/);
  });

  it("omits the mood sentence when mood is null", async () => {
    const result = await generateDailyBriefing({
      ...fullContext,
      mood: null,
    });
    // The mood sentence is only added when ctx.mood is non-null
    expect(result).not.toMatch(/mood of/i);
  });

  it("includes mood sentence when mood is present", async () => {
    const result = await generateDailyBriefing(fullContext);
    expect(result).toMatch(/mood of/i);
  });

  // ── tasks absent but goal present ───────────────────────────────────────────

  it("falls back to the top goal title when tasks array is empty", async () => {
    const result = await generateDailyBriefing({
      ...fullContext,
      tasks: [],
    });
    // With no tasks, mock should reference the first goal
    expect(result).toMatch(/Ship SecondBrain v1/i);
  });
});
