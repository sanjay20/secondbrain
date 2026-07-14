import { describe, it, expect } from "vitest";
import {
  NOTE_PILLARS,
  NOTE_CONTENT_MAX_LEN,
  NOTE_PAGE_LIMIT,
  type NotePillar,
  type Note,
} from "@secondbrain/types";

describe("Note types", () => {
  it("NOTE_PILLARS contains exactly the four life pillars", () => {
    expect([...NOTE_PILLARS].sort()).toEqual(["career", "health", "knowledge", "wealth"]);
  });

  it("does not include the mismatched taxonomies (relationships/personal/finance/habits)", () => {
    const set = new Set<string>(NOTE_PILLARS);
    for (const bad of ["relationships", "personal", "finance", "habits"]) {
      expect(set.has(bad)).toBe(false);
    }
  });

  it("NOTE_CONTENT_MAX_LEN and NOTE_PAGE_LIMIT are sane positive integers", () => {
    expect(NOTE_CONTENT_MAX_LEN).toBe(2000);
    expect(NOTE_PAGE_LIMIT).toBe(100);
  });

  it("NotePillar values are all members of NOTE_PILLARS", () => {
    const pillars: NotePillar[] = ["health", "career", "wealth", "knowledge"];
    for (const p of pillars) expect(NOTE_PILLARS).toContain(p);
  });

  it("Note interface accepts a well-formed note", () => {
    const note: Note = {
      id: "n1",
      userId: "u1",
      content: "hello",
      pillar: "knowledge",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(note.content).toBe("hello");
  });
});
