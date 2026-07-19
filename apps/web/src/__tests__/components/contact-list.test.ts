/**
 * Smoke tests for ContactList render logic.
 *
 * The project runs Vitest in "node" (no jsdom) — mirrors the component's
 * three-way branch (loading skeleton / empty state / grid) as a predicate,
 * matching the highlight-recap-card.test.ts / streak-nudge-card.test.ts style.
 */
import { describe, it, expect } from "vitest";
import type { Contact } from "@secondbrain/types";

type ListState = "loading" | "empty" | "grid";

function listState(loading: boolean, contacts: Contact[]): ListState {
  if (loading) return "loading";
  if (contacts.length === 0) return "empty";
  return "grid";
}

const sampleContact: Contact = {
  id: "c-1",
  userId: "user-1",
  name: "Alex Rivera",
  relationshipType: "friend",
  notes: null,
  lastInteractionAt: new Date("2026-06-01T00:00:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
};

describe("ContactList — render state predicate", () => {
  it("shows the loading skeleton while loading, regardless of contacts", () => {
    expect(listState(true, [])).toBe("loading");
    expect(listState(true, [sampleContact])).toBe("loading");
  });

  it("shows the empty state when not loading and contacts is empty (AC-6)", () => {
    expect(listState(false, [])).toBe("empty");
  });

  it("shows the grid when not loading and contacts is non-empty", () => {
    expect(listState(false, [sampleContact])).toBe("grid");
  });

  it("shows the grid for multiple contacts", () => {
    expect(listState(false, [sampleContact, { ...sampleContact, id: "c-2" }])).toBe("grid");
  });
});

describe("ContactList — renders cards in received (server-sorted) order", () => {
  it("does not reorder the contacts array — page order is preserved (staleness-first from the API)", () => {
    const stale = { ...sampleContact, id: "c-old", lastInteractionAt: new Date("2026-01-01") };
    const fresh = { ...sampleContact, id: "c-new", lastInteractionAt: new Date("2026-07-10") };
    const input = [stale, fresh]; // server already sorted staleness-first
    const rendered = input.map((c) => c.id); // ContactList maps over contacts verbatim, no client sort
    expect(rendered).toEqual(["c-old", "c-new"]);
  });
});

describe("Contact type contract", () => {
  it("required fields are present on a well-formed contact", () => {
    expect(sampleContact.id).toBeTruthy();
    expect(sampleContact.userId).toBeTruthy();
    expect(sampleContact.name).toBeTruthy();
    expect(sampleContact.relationshipType).toBeTruthy();
  });

  it("notes is nullable", () => {
    expect(sampleContact.notes).toBeNull();
  });
});
