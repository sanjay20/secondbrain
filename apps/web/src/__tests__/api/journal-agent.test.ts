/**
 * Unit tests for the journal-agent mock responses (MOCK_AI=true mode).
 * Verifies that when coreValues are provided the mock output references them,
 * and that the path works without coreValues.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("journal-agent — coreValues injection (MOCK_AI=true)", () => {
  let getJournalFollowups: (
    input: Parameters<typeof import("@secondbrain/ai-core")["getJournalFollowups"]>[0]
  ) => Promise<string>;

  beforeEach(async () => {
    process.env.MOCK_AI = "true";
    const mod = await import("@secondbrain/ai-core");
    getJournalFollowups = mod.getJournalFollowups as typeof getJournalFollowups;
  });

  afterEach(() => {
    delete process.env.MOCK_AI;
  });

  const sampleEntries = [
    { content: "Had a productive day at work.", category: "work", mood: "good", when: "2026-05-31" },
  ];

  it("returns a non-empty string without coreValues", async () => {
    const result = await getJournalFollowups({ entries: sampleEntries });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns a non-empty string with coreValues", async () => {
    const result = await getJournalFollowups({
      entries: sampleEntries,
      coreValues: ["Family", "Growth", "Integrity"],
    });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("includes core values by name in mock output when coreValues are provided", async () => {
    const result = await getJournalFollowups({
      entries: sampleEntries,
      coreValues: ["Family", "Growth", "Integrity"],
    });
    expect(result).toMatch(/Family/);
    expect(result).toMatch(/Growth/);
    expect(result).toMatch(/Integrity/);
  });

  it("does not mention core values in mock output when coreValues is empty", async () => {
    const result = await getJournalFollowups({ entries: sampleEntries, coreValues: [] });
    expect(result).not.toMatch(/reflecting your core values/);
  });

  it("does not mention core values in mock output when coreValues is omitted", async () => {
    const result = await getJournalFollowups({ entries: sampleEntries });
    expect(result).not.toMatch(/reflecting your core values/);
  });

  it("includes mock disclaimer note", async () => {
    const result = await getJournalFollowups({ entries: sampleEntries });
    expect(result).toMatch(/Mock response/i);
  });
});
