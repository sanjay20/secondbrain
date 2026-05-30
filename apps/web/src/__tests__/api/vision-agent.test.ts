/**
 * Unit tests for the vision agent mock responses (MOCK_AI=true mode).
 * These tests verify that mock responses have the correct shape without
 * hitting any real AI API.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("vision-agent — mock AI responses (MOCK_AI=true)", () => {
  let getVisionInsights: (
    input: Parameters<typeof import("@secondbrain/ai-core")["getVisionInsights"]>[0]
  ) => Promise<string>;

  beforeEach(async () => {
    process.env.MOCK_AI = "true";
    // Dynamically import so that shouldMockAI() reads the new env value
    const mod = await import("@secondbrain/ai-core");
    getVisionInsights = mod.getVisionInsights as typeof getVisionInsights;
  });

  afterEach(() => {
    delete process.env.MOCK_AI;
  });

  const sampleAreas = [
    {
      name: "Health & Fitness",
      statement: "I will maintain a strong, healthy body through daily exercise and mindful nutrition.",
    },
    {
      name: "Career & Growth",
      statement: "I will build a meaningful career in software engineering and continuously learn.",
    },
    {
      name: "Relationships",
      statement: "I will nurture deep, meaningful connections with family and friends.",
    },
  ];

  const sampleFiveYearGoals = [
    {
      pillar: "career",
      goal: "Become a senior engineer",
      targetYear: 2030,
      progress: 20,
      monthlyTotal: 4,
      monthlyDone: 2,
    },
  ];

  describe("getVisionInsights mock", () => {
    it("returns a non-empty string", async () => {
      const result = await getVisionInsights({ areas: sampleAreas, fiveYearGoals: [] });
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("mentions the number of vision areas in the response", async () => {
      const result = await getVisionInsights({ areas: sampleAreas, fiveYearGoals: [] });
      expect(result).toMatch(/3/);
    });

    it("uses 'area' (singular) when there is exactly 1 area", async () => {
      const result = await getVisionInsights({
        areas: [{ name: "Health", statement: "Stay healthy." }],
        fiveYearGoals: [],
      });
      // The mock uses "area" not "areas" for count=1
      expect(result).toMatch(/1 area[^s]/);
    });

    it("uses 'areas' (plural) when there are multiple areas", async () => {
      const result = await getVisionInsights({ areas: sampleAreas, fiveYearGoals: [] });
      expect(result).toMatch(/3 areas/);
    });

    it("includes recurring themes commentary", async () => {
      const result = await getVisionInsights({ areas: sampleAreas, fiveYearGoals: [] });
      expect(result).toMatch(/Recurring themes/i);
    });

    it("includes alignment commentary", async () => {
      const result = await getVisionInsights({ areas: sampleAreas, fiveYearGoals: [] });
      expect(result).toMatch(/Alignment/i);
    });

    it("includes a motivational note", async () => {
      const result = await getVisionInsights({ areas: sampleAreas, fiveYearGoals: [] });
      expect(result).toMatch(/Motivational note/i);
    });

    it("includes a mock disclaimer note", async () => {
      const result = await getVisionInsights({ areas: sampleAreas, fiveYearGoals: [] });
      expect(result).toMatch(/Mock response/i);
    });

    it("returns a string for an empty areas array", async () => {
      const result = await getVisionInsights({ areas: [], fiveYearGoals: [] });
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("mentions 0 areas when areas list is empty", async () => {
      const result = await getVisionInsights({ areas: [], fiveYearGoals: [] });
      expect(result).toMatch(/0/);
    });

    it("returns correct count for a single area", async () => {
      const result = await getVisionInsights({
        areas: [{ name: "Mind", statement: "Cultivate wisdom." }],
        fiveYearGoals: [],
      });
      expect(result).toMatch(/1/);
    });

    it("returns correct count for two areas", async () => {
      const result = await getVisionInsights({
        areas: [
          { name: "Health", statement: "Stay healthy." },
          { name: "Career", statement: "Grow professionally." },
        ],
        fiveYearGoals: [],
      });
      expect(result).toMatch(/2/);
    });

    it("includes 5-year goal count in response", async () => {
      const result = await getVisionInsights({
        areas: sampleAreas,
        fiveYearGoals: sampleFiveYearGoals,
      });
      expect(result).toMatch(/1 5-year goal/);
    });

    it("mentions no 5-year goals when fiveYearGoals is empty", async () => {
      const result = await getVisionInsights({ areas: sampleAreas, fiveYearGoals: [] });
      expect(result).toMatch(/0 5-year goal/);
    });
  });
});
