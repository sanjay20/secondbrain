import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH, DELETE } from "@/app/api/contacts/[id]/route";
import { prisma } from "@/lib/db";
import { CONTACT_NAME_MAX_LEN, CONTACT_NOTES_MAX_LEN } from "@secondbrain/types";

const db = prisma as unknown as {
  contact: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

const makeReq = (body: unknown) => ({ json: async () => body } as unknown as Request);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

const existingContact = {
  id: "c-1",
  userId: "user-1",
  name: "Alex Rivera",
  relationshipType: "friend",
  notes: null,
  lastInteractionAt: new Date("2026-06-01T00:00:00.000Z"),
  createdAt: new Date("2026-05-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
};

// ─── PATCH /api/contacts/[id] ───────────────────────────────────────────────

describe("PATCH /api/contacts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.contact.findFirst.mockResolvedValue(existingContact);
    db.contact.update.mockResolvedValue({ ...existingContact, name: "Updated" });
  });

  it("verifies ownership via findFirst({ id, userId }) before updating", async () => {
    await PATCH(makeReq({ name: "Updated" }), ctx("c-1"));
    expect(db.contact.findFirst).toHaveBeenCalledWith({ where: { id: "c-1", userId: "user-1" } });
  });

  it("edits name, relationshipType, and notes (FR-4)", async () => {
    const res = await PATCH(
      makeReq({ name: "New Name", relationshipType: "colleague", notes: "Updated notes" }),
      ctx("c-1")
    );
    expect(res.status).toBe(200);
    const call = db.contact.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: "c-1" });
    expect(call.data).toMatchObject({ name: "New Name", relationshipType: "colleague", notes: "Updated notes" });
  });

  it("logInteraction: true sets lastInteractionAt to ~now (AC-3)", async () => {
    const before = Date.now();
    const res = await PATCH(makeReq({ logInteraction: true }), ctx("c-1"));
    expect(res.status).toBe(200);
    const call = db.contact.update.mock.calls[0][0];
    expect(call.data.lastInteractionAt).toBeInstanceOf(Date);
    expect(call.data.lastInteractionAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(call.data.lastInteractionAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("accepts a manual lastInteractionAt edit (ISO datetime)", async () => {
    const iso = "2026-01-15T12:00:00.000Z";
    await PATCH(makeReq({ lastInteractionAt: iso }), ctx("c-1"));
    const call = db.contact.update.mock.calls[0][0];
    expect(call.data.lastInteractionAt).toBeInstanceOf(Date);
    expect(call.data.lastInteractionAt.toISOString()).toBe(iso);
  });

  it("logInteraction: true takes precedence over a provided lastInteractionAt", async () => {
    const iso = "2020-01-01T00:00:00.000Z";
    await PATCH(makeReq({ logInteraction: true, lastInteractionAt: iso }), ctx("c-1"));
    const call = db.contact.update.mock.calls[0][0];
    expect(call.data.lastInteractionAt.toISOString()).not.toBe(iso);
  });

  it("does not touch lastInteractionAt when neither field is provided", async () => {
    await PATCH(makeReq({ name: "Just a rename" }), ctx("c-1"));
    const call = db.contact.update.mock.calls[0][0];
    expect(call.data).not.toHaveProperty("lastInteractionAt");
  });

  it("returns 404 and skips update when the contact is not found", async () => {
    db.contact.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq({ name: "x" }), ctx("missing-id"));
    expect(res.status).toBe(404);
    expect(db.contact.update).not.toHaveBeenCalled();
  });

  it("returns 404 when the contact belongs to a different user (AC-5 isolation)", async () => {
    db.contact.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq({ name: "hijack" }), ctx("c-other-user"));
    expect(res.status).toBe(404);
    expect(db.contact.update).not.toHaveBeenCalled();
  });

  it("returns 400 when name is an empty string", async () => {
    const res = await PATCH(makeReq({ name: "" }), ctx("c-1"));
    expect(res.status).toBe(400);
    expect(db.contact.update).not.toHaveBeenCalled();
  });

  it("returns 400 when name exceeds CONTACT_NAME_MAX_LEN", async () => {
    const res = await PATCH(makeReq({ name: "A".repeat(CONTACT_NAME_MAX_LEN + 1) }), ctx("c-1"));
    expect(res.status).toBe(400);
    expect(db.contact.update).not.toHaveBeenCalled();
  });

  it("returns 400 when notes exceed CONTACT_NOTES_MAX_LEN", async () => {
    const res = await PATCH(makeReq({ notes: "x".repeat(CONTACT_NOTES_MAX_LEN + 1) }), ctx("c-1"));
    expect(res.status).toBe(400);
    expect(db.contact.update).not.toHaveBeenCalled();
  });

  it("returns 400 when lastInteractionAt is not a valid ISO datetime", async () => {
    const res = await PATCH(makeReq({ lastInteractionAt: "2026-01-15" }), ctx("c-1"));
    expect(res.status).toBe(400);
    expect(db.contact.update).not.toHaveBeenCalled();
  });

  it("returns a 400 body shaped as { error: ZodIssue[] }", async () => {
    const res = await PATCH(makeReq({ name: "" }), ctx("c-1"));
    const body = await res.json();
    expect(Array.isArray(body.error)).toBe(true);
  });
});

// ─── DELETE /api/contacts/[id] ──────────────────────────────────────────────

describe("DELETE /api/contacts/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.contact.findFirst.mockResolvedValue(existingContact);
    db.contact.delete.mockResolvedValue(existingContact);
  });

  it("verifies ownership via findFirst({ id, userId }) before deleting", async () => {
    await DELETE({} as Request, ctx("c-1"));
    expect(db.contact.findFirst).toHaveBeenCalledWith({ where: { id: "c-1", userId: "user-1" } });
  });

  it("deletes and returns { success: true } for the owner (FR-5)", async () => {
    const res = await DELETE({} as Request, ctx("c-1"));
    expect(res.status).toBe(200);
    expect(db.contact.delete).toHaveBeenCalledWith({ where: { id: "c-1" } });
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  it("returns 404 and skips delete when the contact is not found", async () => {
    db.contact.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, ctx("missing-id"));
    expect(res.status).toBe(404);
    expect(db.contact.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when the contact belongs to a different user (AC-5 isolation)", async () => {
    db.contact.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, ctx("c-other-user"));
    expect(res.status).toBe(404);
    expect(db.contact.delete).not.toHaveBeenCalled();
  });
});
