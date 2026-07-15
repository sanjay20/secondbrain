/**
 * Smoke tests for ContactForm field logic.
 *
 * The project runs Vitest in "node" (no jsdom), so — like bucket-list-form
 * and streak-nudge-card tests — we mirror the form's pure helpers/branching
 * logic and test them rather than mounting JSX.
 *
 * Mirrors apps/web/src/components/relationships/contact-form.tsx:
 *   - toDateInput(): Date/string -> YYYY-MM-DD for the edit-only date input
 *   - isEdit flag + default values (create vs edit)
 *   - submit URL/method + payload construction (POST create vs PATCH edit)
 *   - dialog title text
 */
import { describe, it, expect } from "vitest";
import { RELATIONSHIP_TYPES, CONTACT_NAME_MAX_LEN, CONTACT_NOTES_MAX_LEN } from "@secondbrain/types";
import type { Contact } from "@secondbrain/types";

function toDateInput(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function isEdit(contact?: Contact): boolean {
  return !!contact;
}

function defaultValuesFor(contact?: Contact) {
  return contact
    ? {
        name: contact.name,
        relationshipType: contact.relationshipType,
        notes: contact.notes ?? "",
        lastInteractionAt: toDateInput(contact.lastInteractionAt),
      }
    : { relationshipType: "friend" };
}

function urlAndMethodFor(contact?: Contact) {
  return contact
    ? { url: `/api/contacts/${contact.id}`, method: "PATCH" as const }
    : { url: "/api/contacts", method: "POST" as const };
}

function payloadFor(
  data: { name: string; relationshipType: string; notes?: string; lastInteractionAt?: string },
  contact?: Contact
) {
  const payload: Record<string, unknown> = {
    name: data.name,
    relationshipType: data.relationshipType,
    notes: data.notes,
  };
  if (contact && data.lastInteractionAt) {
    payload.lastInteractionAt = new Date(data.lastInteractionAt).toISOString();
  }
  return payload;
}

function titleFor(contact?: Contact): string {
  return contact ? "Edit Contact" : "New Contact";
}

const sampleContact: Contact = {
  id: "c-1",
  userId: "user-1",
  name: "Alex Rivera",
  relationshipType: "colleague",
  notes: null,
  lastInteractionAt: new Date("2026-06-15T00:00:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-15T00:00:00.000Z"),
};

describe("ContactForm — toDateInput helper", () => {
  it("formats a Date object as YYYY-MM-DD", () => {
    expect(toDateInput(new Date("2026-06-15T14:30:00.000Z"))).toBe("2026-06-15");
  });

  it("formats an ISO string as YYYY-MM-DD", () => {
    expect(toDateInput("2026-01-05T00:00:00.000Z")).toBe("2026-01-05");
  });
});

describe("ContactForm — isEdit flag", () => {
  it("is false when no contact prop is passed (create mode)", () => {
    expect(isEdit(undefined)).toBe(false);
  });

  it("is true when a contact prop is passed (edit mode)", () => {
    expect(isEdit(sampleContact)).toBe(true);
  });
});

describe("ContactForm — default values (create vs edit)", () => {
  it("create mode defaults relationshipType to 'friend' and nothing else", () => {
    expect(defaultValuesFor(undefined)).toEqual({ relationshipType: "friend" });
  });

  it("edit mode seeds all fields from the contact", () => {
    const values = defaultValuesFor(sampleContact);
    expect(values).toMatchObject({
      name: "Alex Rivera",
      relationshipType: "colleague",
      lastInteractionAt: "2026-06-15",
    });
  });

  it("edit mode falls back notes to empty string when null", () => {
    const values = defaultValuesFor(sampleContact);
    expect(values.notes).toBe("");
  });

  it("edit mode preserves existing notes when present", () => {
    const withNotes = { ...sampleContact, notes: "Met at a conference" };
    const values = defaultValuesFor(withNotes);
    expect(values.notes).toBe("Met at a conference");
  });
});

describe("ContactForm — submit URL + method", () => {
  it("create mode POSTs to /api/contacts", () => {
    expect(urlAndMethodFor(undefined)).toEqual({ url: "/api/contacts", method: "POST" });
  });

  it("edit mode PATCHes /api/contacts/{id}", () => {
    expect(urlAndMethodFor(sampleContact)).toEqual({ url: "/api/contacts/c-1", method: "PATCH" });
  });
});

describe("ContactForm — payload construction", () => {
  it("create payload never includes lastInteractionAt", () => {
    const payload = payloadFor({ name: "Jamie", relationshipType: "friend" }, undefined);
    expect(payload).not.toHaveProperty("lastInteractionAt");
  });

  it("edit payload includes lastInteractionAt when the date field was touched", () => {
    const payload = payloadFor(
      { name: "Alex Rivera", relationshipType: "colleague", lastInteractionAt: "2026-07-01" },
      sampleContact
    );
    expect(payload.lastInteractionAt).toBe(new Date("2026-07-01").toISOString());
  });

  it("edit payload omits lastInteractionAt when the date field is empty", () => {
    const payload = payloadFor({ name: "Alex Rivera", relationshipType: "colleague" }, sampleContact);
    expect(payload).not.toHaveProperty("lastInteractionAt");
  });

  it("payload always carries name, relationshipType, and notes keys", () => {
    const payload = payloadFor({ name: "Jamie", relationshipType: "friend", notes: "hi" }, undefined);
    expect(payload).toMatchObject({ name: "Jamie", relationshipType: "friend", notes: "hi" });
  });
});

describe("ContactForm — dialog title", () => {
  it("shows 'New Contact' in create mode", () => {
    expect(titleFor(undefined)).toBe("New Contact");
  });

  it("shows 'Edit Contact' in edit mode", () => {
    expect(titleFor(sampleContact)).toBe("Edit Contact");
  });
});

describe("ContactForm — relationship type options", () => {
  it("seeds the Select from RELATIONSHIP_TYPES (5 options)", () => {
    expect(RELATIONSHIP_TYPES).toHaveLength(5);
    expect(RELATIONSHIP_TYPES).toContain("friend");
  });

  it("field length limits match the shared constants", () => {
    expect(CONTACT_NAME_MAX_LEN).toBe(120);
    expect(CONTACT_NOTES_MAX_LEN).toBe(2000);
  });
});
