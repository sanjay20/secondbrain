import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH, DELETE } from "@/app/api/notes/[id]/route";
import { prisma } from "@/lib/db";

const db = prisma as unknown as {
  note: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

const makeReq = (body: unknown) => ({ json: async () => body } as unknown as Request);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

const sampleNote = {
  id: "note-1",
  userId: "user-1",
  content: "Original content",
  pillar: "knowledge",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── PATCH /api/notes/[id] ──────────────────────────────────────────────────

describe("PATCH /api/notes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.note.findFirst.mockResolvedValue(sampleNote);
    db.note.update.mockResolvedValue({ ...sampleNote, content: "Updated" });
  });

  it("looks up the note scoped to id AND userId (ownership gate)", async () => {
    await PATCH(makeReq({ content: "Updated" }), ctx("note-1"));
    const call = db.note.findFirst.mock.calls[0][0];
    expect(call.where).toEqual({ id: "note-1", userId: "user-1" });
  });

  it("updates content and returns 200 for the owner", async () => {
    const res = await PATCH(makeReq({ content: "Updated" }), ctx("note-1"));
    expect(res.status).toBe(200);
    const call = db.note.update.mock.calls[0][0];
    expect(call.data).toMatchObject({ content: "Updated" });
  });

  it("updates pillar when provided", async () => {
    await PATCH(makeReq({ pillar: "wealth" }), ctx("note-1"));
    const call = db.note.update.mock.calls[0][0];
    expect(call.data).toMatchObject({ pillar: "wealth" });
  });

  it("returns 404 and does not update when the note is not owned (AC-5)", async () => {
    db.note.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq({ content: "hack" }), ctx("note-1"));
    expect(res.status).toBe(404);
    expect(db.note.update).not.toHaveBeenCalled();
  });

  it("returns 400 when content is empty", async () => {
    const res = await PATCH(makeReq({ content: "  " }), ctx("note-1"));
    expect(res.status).toBe(400);
    expect(db.note.update).not.toHaveBeenCalled();
  });

  it("returns 400 when pillar is invalid", async () => {
    const res = await PATCH(makeReq({ pillar: "nope" }), ctx("note-1"));
    expect(res.status).toBe(400);
    expect(db.note.update).not.toHaveBeenCalled();
  });
});

// ─── DELETE /api/notes/[id] ─────────────────────────────────────────────────

describe("DELETE /api/notes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.note.findFirst.mockResolvedValue(sampleNote);
    db.note.delete.mockResolvedValue(sampleNote);
  });

  it("looks up the note scoped to id AND userId (ownership gate)", async () => {
    await DELETE(makeReq(null), ctx("note-1"));
    const call = db.note.findFirst.mock.calls[0][0];
    expect(call.where).toEqual({ id: "note-1", userId: "user-1" });
  });

  it("deletes and returns success for the owner", async () => {
    const res = await DELETE(makeReq(null), ctx("note-1"));
    expect(res.status).toBe(200);
    expect(db.note.delete).toHaveBeenCalledWith({ where: { id: "note-1" } });
  });

  it("returns 404 and does not delete when the note is not owned (AC-5)", async () => {
    db.note.findFirst.mockResolvedValue(null);
    const res = await DELETE(makeReq(null), ctx("note-1"));
    expect(res.status).toBe(404);
    expect(db.note.delete).not.toHaveBeenCalled();
  });
});
