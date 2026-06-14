import { describe, it, expect, vi, beforeEach } from "vitest";
import { DELETE } from "@/app/api/gratitude/[id]/route";
import { prisma } from "@/lib/db";
import { format, subDays } from "date-fns";

const db = prisma as unknown as {
  gratitudeEntry: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

const makeCtx = (id: string) =>
  ({ params: Promise.resolve({ id }) } as { params: Promise<{ id: string }> });

const today = new Date();
// Construct a date that matches what the route handler sees from getTodayDate()
const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

const todayEntry = {
  id: "ge-1",
  userId: "user-1",
  item: "Good health",
  date: todayMidnight,
  createdAt: todayMidnight,
};

const yesterdayEntry = {
  id: "ge-2",
  userId: "user-1",
  item: "Great coffee",
  date: subDays(todayMidnight, 1),
  createdAt: subDays(todayMidnight, 1),
};

// ─── DELETE /api/gratitude/[id] ───────────────────────────────────────────────

describe("DELETE /api/gratitude/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.gratitudeEntry.findFirst.mockResolvedValue(todayEntry);
    db.gratitudeEntry.delete.mockResolvedValue(todayEntry);
  });

  // Happy path — today's entry

  it("deletes a today entry and returns 200", async () => {
    const res = await DELETE({} as Request, makeCtx("ge-1"));
    expect(res.status).toBe(200);
  });

  it("returns { success: true } on successful delete", async () => {
    const res = await DELETE({} as Request, makeCtx("ge-1"));
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  it("looks up entry by both id AND userId (ownership check)", async () => {
    await DELETE({} as Request, makeCtx("ge-1"));
    expect(db.gratitudeEntry.findFirst).toHaveBeenCalledWith({
      where: { id: "ge-1", userId: "user-1" },
    });
  });

  it("calls delete with the correct id after ownership is confirmed", async () => {
    await DELETE({} as Request, makeCtx("ge-1"));
    expect(db.gratitudeEntry.delete).toHaveBeenCalledWith({ where: { id: "ge-1" } });
  });

  // 404 — not found or wrong user

  it("returns 404 when entry does not exist", async () => {
    db.gratitudeEntry.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("nonexistent"));
    expect(res.status).toBe(404);
    expect(db.gratitudeEntry.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when entry belongs to a different user", async () => {
    // Ownership check uses userId in the query; returning null simulates wrong user
    db.gratitudeEntry.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("ge-other"));
    expect(res.status).toBe(404);
    expect(db.gratitudeEntry.delete).not.toHaveBeenCalled();
  });

  it("returns error body with 'Not found' message on 404", async () => {
    db.gratitudeEntry.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("missing"));
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  // 403 — past-day entry

  it("returns 403 when entry date is yesterday (past day)", async () => {
    db.gratitudeEntry.findFirst.mockResolvedValue(yesterdayEntry);
    const res = await DELETE({} as Request, makeCtx("ge-2"));
    expect(res.status).toBe(403);
    expect(db.gratitudeEntry.delete).not.toHaveBeenCalled();
  });

  it("returns 403 when entry date is further in the past", async () => {
    const oldEntry = { ...todayEntry, id: "ge-old", date: subDays(todayMidnight, 7) };
    db.gratitudeEntry.findFirst.mockResolvedValue(oldEntry);
    const res = await DELETE({} as Request, makeCtx("ge-old"));
    expect(res.status).toBe(403);
    expect(db.gratitudeEntry.delete).not.toHaveBeenCalled();
  });

  it("returns error body with 'Cannot delete past entries' on 403", async () => {
    db.gratitudeEntry.findFirst.mockResolvedValue(yesterdayEntry);
    const res = await DELETE({} as Request, makeCtx("ge-2"));
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body.error).toMatch(/past/i);
  });

  it("does NOT delete when 403 guard triggers", async () => {
    db.gratitudeEntry.findFirst.mockResolvedValue(yesterdayEntry);
    await DELETE({} as Request, makeCtx("ge-2"));
    expect(db.gratitudeEntry.delete).not.toHaveBeenCalled();
  });

  // Date comparison correctness

  it("uses date formatting to compare entry date vs today (no time component)", async () => {
    // Entry date is exactly today midnight — should succeed
    const midnightEntry = { ...todayEntry, date: todayMidnight };
    db.gratitudeEntry.findFirst.mockResolvedValue(midnightEntry);
    const res = await DELETE({} as Request, makeCtx("ge-1"));
    // Should be 200, not 403
    expect(res.status).toBe(200);
  });
});
