import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH, DELETE } from "@/app/api/books/[id]/route";
import { prisma } from "@/lib/db";

const db = prisma as unknown as {
  readingItem: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  highlight: { count: ReturnType<typeof vi.fn> };
  goal: { findMany: ReturnType<typeof vi.fn> };
  habit: { findMany: ReturnType<typeof vi.fn> };
  skill: { findMany: ReturnType<typeof vi.fn> };
  bookLink: {
    deleteMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

const makeReq = (body: unknown, url = "http://localhost/api/books/bk-1") =>
  ({ json: async () => body, url } as unknown as Request);

const params = (id: string) => ({ params: Promise.resolve({ id }) });

const existing = {
  id: "bk-1",
  userId: "user-1",
  title: "Deep Work",
  status: "want",
  category: "technical",
  currentPage: 0,
  totalPages: 300,
};

// ─── PATCH /api/books/[id] ──────────────────────────────────────────────────

describe("PATCH /api/books/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.readingItem.findFirst.mockResolvedValue(existing);
    db.readingItem.update.mockResolvedValue({ ...existing });
    db.$transaction.mockResolvedValue([]);
  });

  it("404s on a book the user does not own, without updating", async () => {
    db.readingItem.findFirst.mockResolvedValueOnce(null);
    const res = await PATCH(makeReq({ status: "reading" }), params("bk-1"));
    expect(res.status).toBe(404);
    expect(db.readingItem.update).not.toHaveBeenCalled();
  });

  it("scopes the ownership lookup to the authenticated user", async () => {
    await PATCH(makeReq({ status: "reading" }), params("bk-1"));
    expect(db.readingItem.findFirst.mock.calls[0][0].where).toEqual({
      id: "bk-1",
      userId: "user-1",
    });
  });

  it("sets finishedAt when the shelf moves to finished", async () => {
    await PATCH(makeReq({ status: "finished" }), params("bk-1"));
    expect(db.readingItem.update.mock.calls[0][0].data.finishedAt).toBeInstanceOf(Date);
  });

  it("clears finishedAt when the shelf moves away from finished", async () => {
    db.readingItem.findFirst.mockResolvedValue({ ...existing, status: "finished" });
    await PATCH(makeReq({ status: "reading" }), params("bk-1"));
    expect(db.readingItem.update.mock.calls[0][0].data.finishedAt).toBeNull();
  });

  it("leaves finishedAt untouched when status is not part of the patch", async () => {
    await PATCH(makeReq({ currentPage: 10 }), params("bk-1"));
    expect(db.readingItem.update.mock.calls[0][0].data).not.toHaveProperty("finishedAt");
  });

  it("snaps currentPage to totalPages when finishing", async () => {
    await PATCH(makeReq({ status: "finished" }), params("bk-1"));
    expect(db.readingItem.update.mock.calls[0][0].data.currentPage).toBe(300);
  });

  it("clamps currentPage to totalPages", async () => {
    await PATCH(makeReq({ currentPage: 5000 }), params("bk-1"));
    expect(db.readingItem.update.mock.calls[0][0].data.currentPage).toBe(300);
  });

  it("does not infer a finished status from the page count", async () => {
    await PATCH(makeReq({ currentPage: 300 }), params("bk-1"));
    expect(db.readingItem.update.mock.calls[0][0].data).not.toHaveProperty("status");
  });

  it("409s on a rename onto an existing title, without updating", async () => {
    db.readingItem.findFirst
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce({ id: "bk-2" });
    const res = await PATCH(makeReq({ title: "Atomic Habits" }), params("bk-1"));
    expect(res.status).toBe(409);
    expect(db.readingItem.update).not.toHaveBeenCalled();
  });

  it("allows a rename when no other book holds the title", async () => {
    db.readingItem.findFirst
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    const res = await PATCH(makeReq({ title: "Atomic Habits" }), params("bk-1"));
    expect(res.status).toBe(200);
    expect(db.readingItem.update.mock.calls[0][0].data.title).toBe("Atomic Habits");
  });

  it("skips the scalar update when the patch is links-only", async () => {
    db.goal.findMany.mockResolvedValue([{ id: "g-1" }]);
    await PATCH(makeReq({ goalIds: ["g-1"] }), params("bk-1"));
    expect(db.readingItem.update).not.toHaveBeenCalled();
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("filters goal ids to ones the user owns", async () => {
    db.goal.findMany.mockResolvedValue([{ id: "g-1" }]);
    await PATCH(makeReq({ goalIds: ["g-1", "someone-elses"] }), params("bk-1"));
    expect(db.goal.findMany.mock.calls[0][0].where).toEqual({
      id: { in: ["g-1", "someone-elses"] },
      userId: "user-1",
    });
    expect(db.bookLink.createMany.mock.calls[0][0].data).toEqual([
      { userId: "user-1", readingItemId: "bk-1", goalId: "g-1" },
    ]);
  });

  it("scopes the goal deleteMany so other link types survive", async () => {
    db.goal.findMany.mockResolvedValue([]);
    await PATCH(makeReq({ goalIds: [] }), params("bk-1"));
    expect(db.bookLink.deleteMany.mock.calls[0][0].where).toEqual({
      readingItemId: "bk-1",
      goalId: { not: null },
    });
  });

  it("treats an empty array as unlink-all for that type", async () => {
    db.goal.findMany.mockResolvedValue([]);
    await PATCH(makeReq({ goalIds: [] }), params("bk-1"));
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.bookLink.createMany.mock.calls[0][0].data).toEqual([]);
  });

  it("writes habit links to the habitId column", async () => {
    db.habit.findMany.mockResolvedValue([{ id: "h-1" }]);
    await PATCH(makeReq({ habitIds: ["h-1"] }), params("bk-1"));
    expect(db.bookLink.deleteMany.mock.calls[0][0].where.habitId).toEqual({ not: null });
    expect(db.bookLink.createMany.mock.calls[0][0].data).toEqual([
      { userId: "user-1", readingItemId: "bk-1", habitId: "h-1" },
    ]);
  });

  it("writes skill links to the skillId column", async () => {
    db.skill.findMany.mockResolvedValue([{ id: "s-1" }]);
    await PATCH(makeReq({ skillIds: ["s-1"] }), params("bk-1"));
    expect(db.bookLink.createMany.mock.calls[0][0].data).toEqual([
      { userId: "user-1", readingItemId: "bk-1", skillId: "s-1" },
    ]);
  });

  // The invariant the single-table design depends on.
  it("writes exactly one target FK per link row", async () => {
    db.goal.findMany.mockResolvedValue([{ id: "g-1" }]);
    db.habit.findMany.mockResolvedValue([{ id: "h-1" }]);
    db.skill.findMany.mockResolvedValue([{ id: "s-1" }]);
    await PATCH(
      makeReq({ goalIds: ["g-1"], habitIds: ["h-1"], skillIds: ["s-1"] }),
      params("bk-1")
    );

    const targetKeys = ["goalId", "habitId", "skillId", "taskId"];
    for (const call of db.bookLink.createMany.mock.calls) {
      for (const row of call[0].data as Record<string, unknown>[]) {
        const set = targetKeys.filter((k) => row[k] !== undefined && row[k] !== null);
        expect(set).toHaveLength(1);
      }
    }
  });

  it("handles all three link types in one patch", async () => {
    db.goal.findMany.mockResolvedValue([{ id: "g-1" }]);
    db.habit.findMany.mockResolvedValue([{ id: "h-1" }]);
    db.skill.findMany.mockResolvedValue([{ id: "s-1" }]);
    await PATCH(
      makeReq({ goalIds: ["g-1"], habitIds: ["h-1"], skillIds: ["s-1"] }),
      params("bk-1")
    );
    expect(db.$transaction).toHaveBeenCalledTimes(3);
  });

  it("touches no link tables when no link keys are present", async () => {
    await PATCH(makeReq({ status: "reading" }), params("bk-1"));
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("returns 400 on an invalid status", async () => {
    const res = await PATCH(makeReq({ status: "abandoned" }), params("bk-1"));
    expect(res.status).toBe(400);
    expect(db.readingItem.update).not.toHaveBeenCalled();
  });

  it("allows clearing a nullable field", async () => {
    await PATCH(makeReq({ author: null }), params("bk-1"));
    expect(db.readingItem.update.mock.calls[0][0].data.author).toBeNull();
  });
});

// ─── DELETE /api/books/[id] ─────────────────────────────────────────────────

describe("DELETE /api/books/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.readingItem.findFirst.mockResolvedValue(existing);
    db.readingItem.delete.mockResolvedValue(existing);
    db.highlight.count.mockResolvedValue(0);
  });

  it("404s on a book the user does not own", async () => {
    db.readingItem.findFirst.mockResolvedValueOnce(null);
    const res = await DELETE(makeReq(null), params("bk-1"));
    expect(res.status).toBe(404);
    expect(db.readingItem.delete).not.toHaveBeenCalled();
  });

  it("deletes a book with no highlights", async () => {
    const res = await DELETE(makeReq(null), params("bk-1"));
    expect(res.status).toBe(200);
    expect(db.readingItem.delete).toHaveBeenCalledWith({ where: { id: "bk-1" } });
  });

  it("refuses with 409 and the real count when highlights would cascade", async () => {
    db.highlight.count.mockResolvedValue(3);
    const res = await DELETE(makeReq(null), params("bk-1"));
    expect(res.status).toBe(409);
    expect(db.readingItem.delete).not.toHaveBeenCalled();
  });

  it("deletes anyway with ?force=true", async () => {
    db.highlight.count.mockResolvedValue(3);
    const res = await DELETE(
      makeReq(null, "http://localhost/api/books/bk-1?force=true"),
      params("bk-1")
    );
    expect(res.status).toBe(200);
    expect(db.readingItem.delete).toHaveBeenCalled();
  });
});
