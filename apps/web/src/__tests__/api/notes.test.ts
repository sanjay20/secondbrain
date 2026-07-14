import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/notes/route";
import { prisma } from "@/lib/db";
import { NOTE_CONTENT_MAX_LEN, NOTE_PAGE_LIMIT } from "@secondbrain/types";

const db = prisma as unknown as {
  note: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

const makeReq = (body: unknown, url = "http://localhost/api/notes") =>
  ({ json: async () => body, url } as unknown as Request);

const sampleNote = {
  id: "note-1",
  userId: "user-1",
  content: "Remember to review the sleep tracker PR",
  pillar: "knowledge",
  createdAt: new Date("2026-07-01T10:00:00.000Z"),
  updatedAt: new Date("2026-07-01T10:00:00.000Z"),
};

// ─── GET /api/notes ─────────────────────────────────────────────────────────

describe("GET /api/notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.note.findMany.mockResolvedValue([sampleNote]);
  });

  it("returns 200 with the notes list", async () => {
    const res = await GET(makeReq(null));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ id: "note-1" });
  });

  it("scopes the query to the authenticated userId (userId first in where)", async () => {
    await GET(makeReq(null));
    const call = db.note.findMany.mock.calls[0][0];
    expect(call.where).toMatchObject({ userId: "user-1" });
    expect(Object.keys(call.where)[0]).toBe("userId");
  });

  it("orders by createdAt desc and applies NOTE_PAGE_LIMIT", async () => {
    await GET(makeReq(null));
    const call = db.note.findMany.mock.calls[0][0];
    expect(call.orderBy).toEqual({ createdAt: "desc" });
    expect(call.take).toBe(NOTE_PAGE_LIMIT);
  });

  it("does not add content/pillar filters when q and pillar are absent", async () => {
    await GET(makeReq(null));
    const call = db.note.findMany.mock.calls[0][0];
    expect(call.where.content).toBeUndefined();
    expect(call.where.pillar).toBeUndefined();
  });

  it("applies a case-insensitive contains filter for ?q=", async () => {
    await GET(makeReq(null, "http://localhost/api/notes?q=sleep"));
    const call = db.note.findMany.mock.calls[0][0];
    expect(call.where.content).toEqual({ contains: "sleep", mode: "insensitive" });
    expect(call.where.userId).toBe("user-1");
  });

  it("applies a pillar filter for ?pillar=", async () => {
    await GET(makeReq(null, "http://localhost/api/notes?pillar=career"));
    const call = db.note.findMany.mock.calls[0][0];
    expect(call.where.pillar).toBe("career");
  });

  it("combines q and pillar filters, still scoped to userId", async () => {
    await GET(makeReq(null, "http://localhost/api/notes?q=goal&pillar=wealth"));
    const call = db.note.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
    expect(call.where.pillar).toBe("wealth");
    expect(call.where.content).toEqual({ contains: "goal", mode: "insensitive" });
  });
});

// ─── POST /api/notes ────────────────────────────────────────────────────────

describe("POST /api/notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.note.create.mockResolvedValue(sampleNote);
  });

  it("creates a note and returns 201", async () => {
    const res = await POST(makeReq({ content: "A new note", pillar: "health" }));
    expect(res.status).toBe(201);
  });

  it("persists the note scoped to the authenticated userId", async () => {
    await POST(makeReq({ content: "A new note", pillar: "health" }));
    const call = db.note.create.mock.calls[0][0];
    expect(call.data).toMatchObject({ userId: "user-1", content: "A new note", pillar: "health" });
  });

  it("trims content before persisting", async () => {
    await POST(makeReq({ content: "   padded   ", pillar: "career" }));
    const call = db.note.create.mock.calls[0][0];
    expect(call.data.content).toBe("padded");
  });

  it("defaults pillar to 'knowledge' when omitted", async () => {
    await POST(makeReq({ content: "No pillar given" }));
    const call = db.note.create.mock.calls[0][0];
    expect(call.data.pillar).toBe("knowledge");
  });

  it("returns 400 and does not create when content is empty", async () => {
    const res = await POST(makeReq({ content: "   " }));
    expect(res.status).toBe(400);
    expect(db.note.create).not.toHaveBeenCalled();
  });

  it("returns 400 when content exceeds NOTE_CONTENT_MAX_LEN", async () => {
    const res = await POST(makeReq({ content: "x".repeat(NOTE_CONTENT_MAX_LEN + 1) }));
    expect(res.status).toBe(400);
    expect(db.note.create).not.toHaveBeenCalled();
  });

  it("accepts content of exactly NOTE_CONTENT_MAX_LEN characters → 201", async () => {
    const res = await POST(makeReq({ content: "x".repeat(NOTE_CONTENT_MAX_LEN) }));
    expect(res.status).toBe(201);
  });

  it("returns 400 when pillar is not a valid enum value", async () => {
    const res = await POST(makeReq({ content: "valid", pillar: "spirituality" }));
    expect(res.status).toBe(400);
    expect(db.note.create).not.toHaveBeenCalled();
  });

  it("returns a ZodError array in the 400 body", async () => {
    const res = await POST(makeReq({ content: "" }));
    const body = await res.json();
    expect(Array.isArray(body.error)).toBe(true);
  });
});
