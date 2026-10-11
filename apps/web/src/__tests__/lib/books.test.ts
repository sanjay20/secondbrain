import { describe, it, expect } from "vitest";
import {
  BOOK_CATEGORY_META,
  BOOK_LINK_CHIP_CLASS,
  BOOK_STATUS_META,
  bookLinkChips,
  bookProgressPct,
  getBookCategoryMeta,
  getBookStatusMeta,
  linkedIdsFor,
} from "@/lib/books";
import { BOOK_CATEGORIES, BOOK_LINK_TARGETS, BOOK_STATUSES } from "@secondbrain/types";
import type { BookLink } from "@secondbrain/types";

const link = (over: Partial<BookLink>): BookLink => ({
  id: "bl-1",
  userId: "user-1",
  readingItemId: "bk-1",
  createdAt: new Date(),
  ...over,
});

describe("bookProgressPct", () => {
  it("returns null without a page count, so callers can hide the bar", () => {
    expect(bookProgressPct({ currentPage: 10, totalPages: null })).toBeNull();
    expect(bookProgressPct({ currentPage: 10, totalPages: undefined })).toBeNull();
    expect(bookProgressPct({ currentPage: 10, totalPages: 0 })).toBeNull();
  });

  it("rounds to a whole percentage", () => {
    expect(bookProgressPct({ currentPage: 1, totalPages: 3 })).toBe(33);
    expect(bookProgressPct({ currentPage: 150, totalPages: 300 })).toBe(50);
  });

  it("clamps to 0-100 even if the page count is stale", () => {
    expect(bookProgressPct({ currentPage: 400, totalPages: 300 })).toBe(100);
    expect(bookProgressPct({ currentPage: 0, totalPages: 300 })).toBe(0);
  });
});

describe("bookLinkChips", () => {
  it("returns nothing when there are no links", () => {
    expect(bookLinkChips({ links: undefined })).toEqual([]);
    expect(bookLinkChips({ links: [] })).toEqual([]);
  });

  it("builds one chip per link with the right kind and label", () => {
    const chips = bookLinkChips({
      links: [
        link({ id: "a", goalId: "g-1", goal: { id: "g-1", title: "Ship v2" } }),
        link({ id: "b", habitId: "h-1", habit: { id: "h-1", name: "Read 10 pages", icon: "📖" } }),
        link({ id: "c", skillId: "s-1", skill: { id: "s-1", name: "Stoicism" } }),
        link({
          id: "d",
          taskId: "t-1",
          task: { id: "t-1", title: "Read ch. 3", status: "done" },
        }),
      ],
    });

    expect(chips).toEqual([
      { id: "a", kind: "goal", label: "Ship v2" },
      { id: "b", kind: "habit", label: "Read 10 pages", icon: "📖" },
      { id: "c", kind: "skill", label: "Stoicism" },
      { id: "d", kind: "task", label: "Read ch. 3", status: "done" },
    ]);
  });

  it("skips a row with no target set rather than rendering a blank chip", () => {
    expect(bookLinkChips({ links: [link({ id: "x" })] })).toEqual([]);
  });
});

describe("linkedIdsFor", () => {
  const links = [
    link({ id: "a", goalId: "g-1" }),
    link({ id: "b", goalId: "g-2" }),
    link({ id: "c", habitId: "h-1" }),
  ];

  it("returns only the ids of the requested target type", () => {
    expect(linkedIdsFor({ links }, "goal")).toEqual(["g-1", "g-2"]);
    expect(linkedIdsFor({ links }, "habit")).toEqual(["h-1"]);
    expect(linkedIdsFor({ links }, "skill")).toEqual([]);
  });

  it("tolerates a missing links array", () => {
    expect(linkedIdsFor({ links: undefined }, "goal")).toEqual([]);
  });
});

describe("meta maps", () => {
  it("covers every status", () => {
    for (const status of BOOK_STATUSES) {
      expect(BOOK_STATUS_META[status]).toBeDefined();
      expect(BOOK_STATUS_META[status].label.length).toBeGreaterThan(0);
    }
  });

  it("covers every category", () => {
    for (const category of BOOK_CATEGORIES) {
      expect(BOOK_CATEGORY_META[category]).toBeDefined();
      expect(BOOK_CATEGORY_META[category].label.length).toBeGreaterThan(0);
    }
  });

  it("covers every link target", () => {
    for (const target of BOOK_LINK_TARGETS) {
      expect(BOOK_LINK_CHIP_CLASS[target]).toBeDefined();
    }
  });

  it("falls back for an unknown value instead of returning undefined", () => {
    expect(getBookStatusMeta("bogus").label).toBe("bogus");
    expect(getBookCategoryMeta("bogus").icon).toBe("📖");
  });
});
