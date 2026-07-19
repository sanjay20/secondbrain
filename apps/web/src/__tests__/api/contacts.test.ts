import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/contacts/route";
import { prisma } from "@/lib/db";
import { CONTACT_NAME_MAX_LEN, CONTACT_NOTES_MAX_LEN, CONTACT_PAGE_LIMIT } from "@secondbrain/types";

const db = prisma as unknown as {
  contact: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

const makeReq = (body: unknown) => ({ json: async () => body } as unknown as Request);

const sampleContact = {
  id: "c-1",
  userId: "user-1",
  name: "Alex Rivera",
  relationshipType: "friend",
  notes: null,
  lastInteractionAt: new Date("2026-06-01T00:00:00.000Z"),
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
};

// ─── GET /api/contacts ──────────────────────────────────────────────────────

describe("GET /api/contacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.contact.findMany.mockResolvedValue([sampleContact]);
  });

  it("returns 200 with contacts", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0]).toMatchObject({ id: "c-1" });
  });

  it("scopes the query to the authenticated userId", async () => {
    await GET();
    const call = db.contact.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
  });

  it("sorts staleness-first: lastInteractionAt asc, createdAt asc tie-break (AC-4)", async () => {
    await GET();
    const call = db.contact.findMany.mock.calls[0][0];
    expect(call.orderBy).toEqual([{ lastInteractionAt: "asc" }, { createdAt: "asc" }]);
  });

  it("caps results at CONTACT_PAGE_LIMIT", async () => {
    await GET();
    const call = db.contact.findMany.mock.calls[0][0];
    expect(call.take).toBe(CONTACT_PAGE_LIMIT);
  });
});

// ─── POST /api/contacts ─────────────────────────────────────────────────────

describe("POST /api/contacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.contact.create.mockResolvedValue(sampleContact);
  });

  it("creates a contact scoped to userId → 201 (AC-1)", async () => {
    const res = await POST(makeReq({ name: "Alex Rivera" }));
    expect(res.status).toBe(201);
    const call = db.contact.create.mock.calls[0][0];
    expect(call.data.userId).toBe("user-1");
    expect(call.data.name).toBe("Alex Rivera");
  });

  it("defaults relationshipType to 'friend' when omitted", async () => {
    await POST(makeReq({ name: "Alex Rivera" }));
    const call = db.contact.create.mock.calls[0][0];
    expect(call.data.relationshipType).toBe("friend");
  });

  it("passes through a provided relationshipType", async () => {
    await POST(makeReq({ name: "Jamie Lee", relationshipType: "colleague" }));
    const call = db.contact.create.mock.calls[0][0];
    expect(call.data.relationshipType).toBe("colleague");
  });

  it("accepts optional notes", async () => {
    await POST(makeReq({ name: "Jamie Lee", notes: "Met at a conference" }));
    const call = db.contact.create.mock.calls[0][0];
    expect(call.data.notes).toBe("Met at a conference");
  });

  it("returns 400 when name is empty", async () => {
    const res = await POST(makeReq({ name: "   " }));
    expect(res.status).toBe(400);
    expect(db.contact.create).not.toHaveBeenCalled();
  });

  it("returns 400 when name is missing", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    expect(db.contact.create).not.toHaveBeenCalled();
  });

  it("returns 400 when name exceeds CONTACT_NAME_MAX_LEN", async () => {
    const res = await POST(makeReq({ name: "A".repeat(CONTACT_NAME_MAX_LEN + 1) }));
    expect(res.status).toBe(400);
    expect(db.contact.create).not.toHaveBeenCalled();
  });

  it("accepts a name of exactly CONTACT_NAME_MAX_LEN → 201", async () => {
    const res = await POST(makeReq({ name: "A".repeat(CONTACT_NAME_MAX_LEN) }));
    expect(res.status).toBe(201);
  });

  it("returns 400 when notes exceed CONTACT_NOTES_MAX_LEN", async () => {
    const res = await POST(makeReq({ name: "Alex", notes: "x".repeat(CONTACT_NOTES_MAX_LEN + 1) }));
    expect(res.status).toBe(400);
    expect(db.contact.create).not.toHaveBeenCalled();
  });

  it("returns a 400 body shaped as { error: ZodIssue[] }", async () => {
    const res = await POST(makeReq({ name: "" }));
    const body = await res.json();
    expect(Array.isArray(body.error)).toBe(true);
    expect(body.error.length).toBeGreaterThan(0);
  });
});
