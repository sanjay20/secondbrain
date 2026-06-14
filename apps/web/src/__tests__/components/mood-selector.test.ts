/**
 * Smoke tests for MoodSelector component.
 *
 * Because the project runs Vitest in "node" environment (no DOM / jsdom),
 * we verify module exports and the MOOD_LEVELS constant rather than rendering.
 * Full render tests would require installing @testing-library/react + jsdom.
 */
import { describe, it, expect } from "vitest";
import { MOOD_LEVELS } from "@secondbrain/types";

describe("MOOD_LEVELS constant (consumed by MoodSelector)", () => {
  it("defines exactly 5 levels (1–5)", () => {
    const keys = Object.keys(MOOD_LEVELS).map(Number);
    expect(keys).toHaveLength(5);
    expect(keys).toEqual([1, 2, 3, 4, 5]);
  });

  it("each level has an emoji and a label", () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      const entry = MOOD_LEVELS[level];
      expect(typeof entry.emoji).toBe("string");
      expect(entry.emoji.length).toBeGreaterThan(0);
      expect(typeof entry.label).toBe("string");
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });

  it("has specific emoji for each level", () => {
    expect(MOOD_LEVELS[1].emoji).toBe("😞");
    expect(MOOD_LEVELS[2].emoji).toBe("😕");
    expect(MOOD_LEVELS[3].emoji).toBe("😐");
    expect(MOOD_LEVELS[4].emoji).toBe("🙂");
    expect(MOOD_LEVELS[5].emoji).toBe("😄");
  });

  it("level 1 is labelled 'Very low' and level 5 is labelled 'Great'", () => {
    expect(MOOD_LEVELS[1].label).toBe("Very low");
    expect(MOOD_LEVELS[5].label).toBe("Great");
  });
});

/**
 * NOTE: Direct import of the .tsx component is omitted here because Vitest
 * runs in "node" environment without a JSX transform. The MOOD_LEVELS tests
 * above cover the core data contract that MoodSelector depends on.
 * A full render test would require adding @vitejs/plugin-react and jsdom to
 * the vitest config — tracked as a future enhancement.
 */
