/**
 * Helper/logic unit tests for the Relationships page's derived stats and the
 * contacts API's staleness sort key.
 *
 * Mirrors apps/web/src/app/(dashboard)/relationships/page.tsx's overdueCount
 * derivation (OVERDUE_DAYS = 30) and apps/web/src/app/api/contacts/route.ts's
 * orderBy ([{ lastInteractionAt: "asc" }, { createdAt: "asc" }]) as a
 * predicate/comparator — matching the SB-6 nutrition.test.ts approach of
 * testing pure logic instead of mounting JSX.
 */
import { describe, it, expect } from "vitest";
import {
  RELATIONSHIP_TYPES,
  CONTACT_NAME_MAX_LEN,
  CONTACT_NOTES_MAX_LEN,
  CONTACT_PAGE_LIMIT,
} from "@secondbrain/types";
import type { Contact } from "@secondbrain/types";

const OVERDUE_DAYS = 30;

function computeOverdueCount(contacts: Contact[], now: number): number {
  const threshold = now - OVERDUE_DAYS * 86_400_000;
  return contacts.filter((c) => new Date(c.lastInteractionAt).getTime() < threshold).length;
}

function compareStaleness(a: Contact, b: Contact): number {
  const byInteraction = new Date(a.lastInteractionAt).getTime() - new Date(b.lastInteractionAt).getTime();
  if (byInteraction !== 0) return byInteraction;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

function makeContact(overrides: Partial<Contact>): Contact {
  return {
    id: "c",
    userId: "user-1",
    name: "Person",
    relationshipType: "friend",
    notes: null,
    lastInteractionAt: new Date("2026-06-01"),
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-06-01"),
    ...overrides,
  };
}

const NOW = new Date("2026-07-15T00:00:00.000Z").getTime();

describe("Relationships page — overdue count (30d+)", () => {
  it("counts contacts whose lastInteractionAt is older than 30 days", () => {
    const overdue = makeContact({ id: "c-1", lastInteractionAt: new Date(NOW - 45 * 86_400_000) });
    const recent = makeContact({ id: "c-2", lastInteractionAt: new Date(NOW - 5 * 86_400_000) });
    expect(computeOverdueCount([overdue, recent], NOW)).toBe(1);
  });

  it("does not count a contact exactly at the 30-day threshold (strictly older)", () => {
    const atThreshold = makeContact({ lastInteractionAt: new Date(NOW - 30 * 86_400_000) });
    expect(computeOverdueCount([atThreshold], NOW)).toBe(0);
  });

  it("counts a contact one millisecond past the threshold", () => {
    const justOver = makeContact({ lastInteractionAt: new Date(NOW - 30 * 86_400_000 - 1) });
    expect(computeOverdueCount([justOver], NOW)).toBe(1);
  });

  it("returns 0 for an empty contact list", () => {
    expect(computeOverdueCount([], NOW)).toBe(0);
  });

  it("returns 0 when all contacts are recent", () => {
    const a = makeContact({ id: "c-1", lastInteractionAt: new Date(NOW - 1 * 86_400_000) });
    const b = makeContact({ id: "c-2", lastInteractionAt: new Date(NOW - 2 * 86_400_000) });
    expect(computeOverdueCount([a, b], NOW)).toBe(0);
  });
});

describe("Contacts API — staleness sort key (AC-4)", () => {
  it("orders oldest-interaction-first (ascending)", () => {
    const older = makeContact({ id: "c-old", lastInteractionAt: new Date("2026-01-01") });
    const newer = makeContact({ id: "c-new", lastInteractionAt: new Date("2026-06-01") });
    const sorted = [newer, older].sort(compareStaleness);
    expect(sorted.map((c) => c.id)).toEqual(["c-old", "c-new"]);
  });

  it("breaks ties on lastInteractionAt using createdAt ascending", () => {
    const sameInteraction = new Date("2026-06-01");
    const earlierCreated = makeContact({
      id: "c-first",
      lastInteractionAt: sameInteraction,
      createdAt: new Date("2026-01-01"),
    });
    const laterCreated = makeContact({
      id: "c-second",
      lastInteractionAt: sameInteraction,
      createdAt: new Date("2026-03-01"),
    });
    const sorted = [laterCreated, earlierCreated].sort(compareStaleness);
    expect(sorted.map((c) => c.id)).toEqual(["c-first", "c-second"]);
  });

  it("is stable for a mixed list of several contacts", () => {
    const contacts = [
      makeContact({ id: "c-3", lastInteractionAt: new Date("2026-05-01") }),
      makeContact({ id: "c-1", lastInteractionAt: new Date("2026-01-01") }),
      makeContact({ id: "c-2", lastInteractionAt: new Date("2026-03-01") }),
    ];
    const sorted = [...contacts].sort(compareStaleness);
    expect(sorted.map((c) => c.id)).toEqual(["c-1", "c-2", "c-3"]);
  });
});

describe("Relationship type + field-limit constants", () => {
  it("RELATIONSHIP_TYPES has the 5 expected values in order", () => {
    expect(RELATIONSHIP_TYPES).toEqual(["family", "friend", "colleague", "mentor", "other"]);
  });

  it("exposes the field-length and page-size limits used by the API + form", () => {
    expect(CONTACT_NAME_MAX_LEN).toBe(120);
    expect(CONTACT_NOTES_MAX_LEN).toBe(2000);
    expect(CONTACT_PAGE_LIMIT).toBe(200);
  });
});
