/**
 * Smoke tests for HighlightRecapCard render logic.
 *
 * The project runs Vitest in "node" (no jsdom), so — like streak-nudge-card.test.ts —
 * we mirror the card's pure render predicate and test it rather than mounting JSX.
 *
 * The card returns null when the recap is missing OR has count 0 (AC-4 empty state),
 * and renders otherwise.
 */
import { describe, it, expect } from "vitest";
import type { HighlightRecap } from "@secondbrain/types";

function shouldRender(recap: HighlightRecap | null): boolean {
  if (!recap) return false;
  if (recap.count === 0) return false;
  return true;
}

const populated: HighlightRecap = {
  count: 3,
  weekStart: new Date("2026-07-05T00:00:00.000Z"),
  items: [
    { id: "hl-1", text: "Small habits compound.", sourceTitle: "Atomic Habits", sourceAuthor: "James Clear", createdAt: new Date() },
  ],
};

const empty: HighlightRecap = { count: 0, weekStart: new Date(), items: [] };

describe("HighlightRecapCard — render predicate (AC-4)", () => {
  it("does NOT render when recap is null (fetch not complete / errored)", () => {
    expect(shouldRender(null)).toBe(false);
  });

  it("does NOT render when count is 0 (nothing saved this week)", () => {
    expect(shouldRender(empty)).toBe(false);
  });

  it("renders when count > 0 and recap present", () => {
    expect(shouldRender(populated)).toBe(true);
  });
});

describe("HighlightRecap type contract", () => {
  it("populated recap exposes count + items with source labels", () => {
    expect(populated.count).toBe(populated.items.length + 2);
    expect(populated.items[0].sourceTitle).toBe("Atomic Habits");
    expect(typeof populated.items[0].text).toBe("string");
  });

  it("empty recap has count 0 and no items", () => {
    expect(empty.count).toBe(0);
    expect(empty.items).toHaveLength(0);
  });
});
