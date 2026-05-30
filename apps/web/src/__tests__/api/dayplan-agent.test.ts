/**
 * Unit tests for the dayplan agent mock responses (MOCK_AI=true mode).
 * These tests verify that mock responses have the correct shape without
 * hitting any real AI API.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// We test the agent directly by importing it and forcing MOCK_AI=true
// via process.env before the module is loaded.

describe("dayplan-agent — mock AI responses (MOCK_AI=true)", () => {
  let getDayPlan: (input: Parameters<typeof import("@secondbrain/ai-core")["getDayPlan"]>[0]) => Promise<unknown>;
  let getEndOfDaySummary: (input: Parameters<typeof import("@secondbrain/ai-core")["getEndOfDaySummary"]>[0]) => Promise<string>;

  beforeEach(async () => {
    process.env.MOCK_AI = "true";
    // Dynamically import so that shouldMockAI() reads the new env value
    const mod = await import("@secondbrain/ai-core");
    getDayPlan = mod.getDayPlan as typeof getDayPlan;
    getEndOfDaySummary = mod.getEndOfDaySummary as typeof getEndOfDaySummary;
  });

  afterEach(() => {
    delete process.env.MOCK_AI;
  });

  const sampleInput = {
    tasks: [
      { id: "t-1", title: "Write tests", pillar: "work", priority: "high", scheduledDate: "2026-05-30" },
      { id: "t-2", title: "Review PRs", pillar: "work", priority: "medium", scheduledDate: "2026-05-30" },
      { id: "t-3", title: "Exercise", pillar: "health", priority: "high", scheduledDate: "2026-05-30" },
      { id: "t-4", title: "Read book", pillar: "knowledge", priority: "low", scheduledDate: "2026-05-30" },
    ],
    goals: [
      { title: "Ship SB-22", status: "active", priority: "high", progress: 80 },
    ],
    habits: [
      { name: "Morning run", streak: 7 },
    ],
  };

  describe("getDayPlan mock", () => {
    it("returns exactly 3 items", async () => {
      const result = await getDayPlan(sampleInput) as { items: unknown[]; generatedAt: string };
      expect(result.items).toHaveLength(3);
    });

    it("each item has title and rationale as strings", async () => {
      const result = await getDayPlan(sampleInput) as { items: Array<{ title: string; rationale: string }> };
      for (const item of result.items) {
        expect(typeof item.title).toBe("string");
        expect(item.title.length).toBeGreaterThan(0);
        expect(typeof item.rationale).toBe("string");
        expect(item.rationale.length).toBeGreaterThan(0);
      }
    });

    it("includes a generatedAt ISO timestamp", async () => {
      const result = await getDayPlan(sampleInput) as { items: unknown[]; generatedAt: string };
      expect(typeof result.generatedAt).toBe("string");
      expect(() => new Date(result.generatedAt)).not.toThrow();
      expect(new Date(result.generatedAt).toISOString()).toBe(result.generatedAt);
    });

    it("first items reference provided tasks by title", async () => {
      const result = await getDayPlan(sampleInput) as { items: Array<{ title: string }> };
      const itemTitles = result.items.map((i) => i.title);
      // Top 3 tasks should be referenced (mock picks tasks.slice(0, 3))
      expect(itemTitles).toContain("Write tests");
      expect(itemTitles).toContain("Review PRs");
      expect(itemTitles).toContain("Exercise");
    });

    it("includes taskId for items derived from tasks", async () => {
      const result = await getDayPlan(sampleInput) as { items: Array<{ taskId?: string }> };
      const withId = result.items.filter((i) => i.taskId !== undefined);
      expect(withId.length).toBeGreaterThan(0);
    });

    it("still returns 3 items when fewer than 3 tasks are provided", async () => {
      const result = await getDayPlan({
        tasks: [{ id: "t-1", title: "Only task", pillar: null, priority: "high", scheduledDate: "2026-05-30" }],
        goals: [],
        habits: [],
      }) as { items: unknown[] };
      expect(result.items).toHaveLength(3);
    });

    it("returns 3 items even with no tasks at all", async () => {
      const result = await getDayPlan({ tasks: [], goals: [], habits: [] }) as { items: unknown[] };
      expect(result.items).toHaveLength(3);
    });
  });

  describe("getEndOfDaySummary mock", () => {
    const summaryInput = {
      completedTasks: [{ title: "Write tests", pillar: "work" }, { title: "Exercise", pillar: "health" }],
      pendingTasks: [{ title: "Read book", priority: "low" }],
      completedHabits: 3,
      totalHabits: 4,
    };

    it("returns a non-empty string", async () => {
      const result = await getEndOfDaySummary(summaryInput);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("mentions completed task count in the summary", async () => {
      const result = await getEndOfDaySummary(summaryInput);
      expect(result).toMatch(/2/); // 2 completed tasks
    });

    it("mentions pending task count", async () => {
      const result = await getEndOfDaySummary(summaryInput);
      expect(result).toMatch(/1/); // 1 pending task
    });

    it("includes habit completion percentage", async () => {
      const result = await getEndOfDaySummary(summaryInput);
      expect(result).toMatch(/75/); // 3/4 = 75%
    });

    it("returns 0% habit rate when totalHabits is 0", async () => {
      const result = await getEndOfDaySummary({
        completedTasks: [],
        pendingTasks: [],
        completedHabits: 0,
        totalHabits: 0,
      });
      expect(result).toMatch(/0%/);
    });
  });
});
