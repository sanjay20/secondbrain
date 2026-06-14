import { describe, it, expect, vi, beforeEach } from "vitest";
import { DELETE } from "@/app/api/affirmations/[id]/route";
import { prisma } from "@/lib/db";

const db = prisma as unknown as {
  affirmation: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

const makeCtx = (id: string) =>
  ({ params: Promise.resolve({ id }) } as { params: Promise<{ id: string }> });

const now = new Date();

const ownedAffirmation = {
  id: "aff-1",
  userId: "user-1",
  text: "I am capable and strong",
  createdAt: now,
};

// ─── DELETE /api/affirmations/[id] ───────────────────────────────────────────

describe("DELETE /api/affirmations/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.affirmation.findFirst.mockResolvedValue(ownedAffirmation);
    db.affirmation.delete.mockResolvedValue(ownedAffirmation);
  });

  // Happy path

  it("deletes an owned affirmation and returns 200", async () => {
    const res = await DELETE({} as Request, makeCtx("aff-1"));
    expect(res.status).toBe(200);
  });

  it("returns { success: true } on successful delete", async () => {
    const res = await DELETE({} as Request, makeCtx("aff-1"));
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  it("looks up entry by both id AND userId (ownership check)", async () => {
    await DELETE({} as Request, makeCtx("aff-1"));
    expect(db.affirmation.findFirst).toHaveBeenCalledWith({
      where: { id: "aff-1", userId: "user-1" },
    });
  });

  it("calls delete with the correct id after ownership is confirmed", async () => {
    await DELETE({} as Request, makeCtx("aff-1"));
    expect(db.affirmation.delete).toHaveBeenCalledWith({ where: { id: "aff-1" } });
  });

  it("allows deleting an old affirmation (no date restriction)", async () => {
    // Affirmations have no date field — any owned affirmation can be deleted
    const oldAffirmation = { ...ownedAffirmation, id: "aff-old", createdAt: new Date("2020-01-01") };
    db.affirmation.findFirst.mockResolvedValue(oldAffirmation);
    const res = await DELETE({} as Request, makeCtx("aff-old"));
    expect(res.status).toBe(200);
    expect(db.affirmation.delete).toHaveBeenCalledWith({ where: { id: "aff-old" } });
  });

  it("allows deleting a recently created affirmation", async () => {
    const recentAffirmation = { ...ownedAffirmation, id: "aff-new", createdAt: new Date() };
    db.affirmation.findFirst.mockResolvedValue(recentAffirmation);
    const res = await DELETE({} as Request, makeCtx("aff-new"));
    expect(res.status).toBe(200);
  });

  // 404 — not found or wrong user

  it("returns 404 when affirmation does not exist", async () => {
    db.affirmation.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("nonexistent"));
    expect(res.status).toBe(404);
    expect(db.affirmation.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when affirmation belongs to a different user", async () => {
    // Ownership check uses userId in the query; returning null simulates wrong user
    db.affirmation.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("aff-other"));
    expect(res.status).toBe(404);
    expect(db.affirmation.delete).not.toHaveBeenCalled();
  });

  it("returns error body with 'Not found' message on 404", async () => {
    db.affirmation.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("missing"));
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);
  });

  it("does not call delete when ownership check fails", async () => {
    db.affirmation.findFirst.mockResolvedValue(null);
    await DELETE({} as Request, makeCtx("aff-other"));
    expect(db.affirmation.delete).not.toHaveBeenCalled();
  });

  it("does not return 403 (affirmations have no date restriction unlike Gratitude)", async () => {
    // Confirm there is no 403 path — only 200 (success) or 404 (not found)
    db.affirmation.findFirst.mockResolvedValue(ownedAffirmation);
    const res = await DELETE({} as Request, makeCtx("aff-1"));
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(200);
  });
});
