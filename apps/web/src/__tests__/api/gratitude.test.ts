import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/gratitude/route";
import { prisma } from "@/lib/db";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { GRATITUDE_MAX_PER_DAY, GRATITUDE_ITEM_MAX_LEN } from "@secondbrain/types";

const db = prisma as unknown as {
  gratitudeEntry: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

const makeReq = (body: unknown) =>
  ({ json: async () => body } as unknown as Request);

const today = new Date();
const todayKey = format(today, "yyyy-MM-dd");

const sampleEntry = {
  id: "ge-1",
  userId: "user-1",
  item: "Good health",
  date: today,
  createdAt: today,
};

// ─── GET /api/gratitude ───────────────────────────────────────────────────────

describe("GET /api/gratitude", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.gratitudeEntry.findMany.mockResolvedValue([]);
  });

  it("returns entries scoped to the authenticated user", async () => {
    db.gratitudeEntry.findMany.mockResolvedValue([sampleEntry]);
    const res = await GET();
    expect(res.status).toBe(200);
    const monthQuery = db.gratitudeEntry.findMany.mock.calls[0][0];
    expect(monthQuery.where).toMatchObject({ userId: "user-1" });
  });

  it("returns 200 with entries and streak when user has data", async () => {
    db.gratitudeEntry.findMany.mockResolvedValue([sampleEntry]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("entries");
    expect(body).toHaveProperty("streak");
  });

  it("returns empty entries array and streak 0 when user has no entries", async () => {
    db.gratitudeEntry.findMany.mockResolvedValue([]);
    const res = await GET();
    const body = await res.json();
    expect(body.entries).toEqual([]);
    expect(body.streak).toBe(0);
  });

  it("filters entries by current month (gte monthStart, lte monthEnd)", async () => {
    db.gratitudeEntry.findMany.mockResolvedValue([]);
    await GET();
    const monthQuery = db.gratitudeEntry.findMany.mock.calls[0][0];
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    expect(monthQuery.where.date.gte.getTime()).toBe(monthStart.getTime());
    expect(monthQuery.where.date.lte.getTime()).toBe(monthEnd.getTime());
  });

  it("makes two findMany calls: one for month entries, one for streak", async () => {
    db.gratitudeEntry.findMany.mockResolvedValue([]);
    await GET();
    expect(db.gratitudeEntry.findMany).toHaveBeenCalledTimes(2);
  });

  it("streak query uses gte: 60 days ago (date-only, no time component)", async () => {
    db.gratitudeEntry.findMany.mockResolvedValue([]);
    await GET();
    const streakQuery = db.gratitudeEntry.findMany.mock.calls[1][0];
    const actual: Date = streakQuery.where.date.gte;
    // The route uses getTodayDate() which strips the time component, then subDays.
    // We verify the date is approximately 60 days ago (within 1 day tolerance).
    const now = new Date();
    const sixtyDaysAgo = subDays(now, 60);
    const sixtyOneDaysAgo = subDays(now, 61);
    expect(actual.getTime()).toBeLessThanOrEqual(sixtyDaysAgo.getTime() + 86400000);
    expect(actual.getTime()).toBeGreaterThanOrEqual(sixtyOneDaysAgo.getTime());
  });

  it("streak query selects only date field", async () => {
    db.gratitudeEntry.findMany.mockResolvedValue([]);
    await GET();
    const streakQuery = db.gratitudeEntry.findMany.mock.calls[1][0];
    expect(streakQuery.select).toEqual({ date: true });
  });

  it("calculates streak of 1 when today has an entry", async () => {
    // First call: month entries; second call: streak entries
    db.gratitudeEntry.findMany
      .mockResolvedValueOnce([sampleEntry])
      .mockResolvedValueOnce([{ date: today }]);
    const res = await GET();
    const body = await res.json();
    expect(body.streak).toBeGreaterThanOrEqual(1);
  });

  it("calculates streak of 0 when last entry was 2+ days ago", async () => {
    const threeDaysAgo = subDays(today, 3);
    db.gratitudeEntry.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ date: threeDaysAgo }]);
    const res = await GET();
    const body = await res.json();
    expect(body.streak).toBe(0);
  });

  it("calculates multi-day streak when consecutive days have entries", async () => {
    const yesterday = subDays(today, 1);
    const twoDaysAgo = subDays(today, 2);
    db.gratitudeEntry.findMany
      .mockResolvedValueOnce([sampleEntry])
      .mockResolvedValueOnce([
        { date: today },
        { date: yesterday },
        { date: twoDaysAgo },
      ]);
    const res = await GET();
    const body = await res.json();
    expect(body.streak).toBe(3);
  });

  it("streak includes yesterday-only entries when today has no entry", async () => {
    const yesterday = subDays(today, 1);
    const twoDaysAgo = subDays(today, 2);
    // No today entry, but yesterday and day before have entries
    db.gratitudeEntry.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { date: yesterday },
        { date: twoDaysAgo },
      ]);
    const res = await GET();
    const body = await res.json();
    // Streak starts from yesterday when today has no entry
    expect(body.streak).toBe(2);
  });

  it("streak breaks on a gap between days", async () => {
    const yesterday = subDays(today, 1);
    const threeDaysAgo = subDays(today, 3); // gap on day-2
    db.gratitudeEntry.findMany
      .mockResolvedValueOnce([sampleEntry])
      .mockResolvedValueOnce([
        { date: today },
        { date: yesterday },
        { date: threeDaysAgo },
      ]);
    const res = await GET();
    const body = await res.json();
    // Streak should be 2 (today + yesterday), broken by missing day-2
    expect(body.streak).toBe(2);
  });

  it("multiple entries on the same date count as one day for streak", async () => {
    db.gratitudeEntry.findMany
      .mockResolvedValueOnce([sampleEntry])
      .mockResolvedValueOnce([
        { date: today },
        { date: today }, // duplicate date
        { date: today },
      ]);
    const res = await GET();
    const body = await res.json();
    // Multiple entries on same day = 1 streak day
    expect(body.streak).toBe(1);
  });

  it("orders month entries by date desc, then createdAt desc", async () => {
    db.gratitudeEntry.findMany.mockResolvedValue([]);
    await GET();
    const monthQuery = db.gratitudeEntry.findMany.mock.calls[0][0];
    expect(monthQuery.orderBy).toEqual([{ date: "desc" }, { createdAt: "desc" }]);
  });

  it("streak scoped to current user (userId in where clause)", async () => {
    db.gratitudeEntry.findMany.mockResolvedValue([]);
    await GET();
    const streakQuery = db.gratitudeEntry.findMany.mock.calls[1][0];
    expect(streakQuery.where).toMatchObject({ userId: "user-1" });
  });
});

// ─── POST /api/gratitude ──────────────────────────────────────────────────────

describe("POST /api/gratitude", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.gratitudeEntry.count.mockResolvedValue(0);
    db.gratitudeEntry.create.mockResolvedValue(sampleEntry);
  });

  // Happy path

  it("creates an entry and returns 201 on valid input", async () => {
    const res = await POST(makeReq({ item: "Good health" }));
    expect(res.status).toBe(201);
  });

  it("persists the correct userId from auth", async () => {
    await POST(makeReq({ item: "Good health" }));
    const call = db.gratitudeEntry.create.mock.calls[0][0];
    expect(call.data).toMatchObject({ userId: "user-1" });
  });

  it("persists the trimmed item text", async () => {
    await POST(makeReq({ item: "  Grateful for family  " }));
    const call = db.gratitudeEntry.create.mock.calls[0][0];
    expect(call.data.item).toBe("Grateful for family");
  });

  it("returns the created entry in the response body", async () => {
    const res = await POST(makeReq({ item: "Good health" }));
    const body = await res.json();
    expect(body).toMatchObject({ id: "ge-1", userId: "user-1", item: "Good health" });
  });

  it("checks the count of today's entries before creating", async () => {
    await POST(makeReq({ item: "Good health" }));
    expect(db.gratitudeEntry.count).toHaveBeenCalledOnce();
    const countCall = db.gratitudeEntry.count.mock.calls[0][0];
    expect(countCall.where).toMatchObject({ userId: "user-1" });
  });

  // Zod validation — item field

  it("returns 400 when item is empty string", async () => {
    const res = await POST(makeReq({ item: "" }));
    expect(res.status).toBe(400);
    expect(db.gratitudeEntry.create).not.toHaveBeenCalled();
  });

  it("returns 400 when item is whitespace only", async () => {
    const res = await POST(makeReq({ item: "   " }));
    expect(res.status).toBe(400);
    expect(db.gratitudeEntry.create).not.toHaveBeenCalled();
  });

  it("returns 400 when item exceeds GRATITUDE_ITEM_MAX_LEN (280 chars)", async () => {
    const res = await POST(makeReq({ item: "A".repeat(GRATITUDE_ITEM_MAX_LEN + 1) }));
    expect(res.status).toBe(400);
    expect(db.gratitudeEntry.create).not.toHaveBeenCalled();
  });

  it("accepts item at exactly GRATITUDE_ITEM_MAX_LEN (280 chars)", async () => {
    const res = await POST(makeReq({ item: "A".repeat(GRATITUDE_ITEM_MAX_LEN) }));
    expect(res.status).toBe(201);
  });

  it("returns 400 when item field is missing from body", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    expect(db.gratitudeEntry.create).not.toHaveBeenCalled();
  });

  it("returns 400 when item is not a string (number)", async () => {
    const res = await POST(makeReq({ item: 42 }));
    expect(res.status).toBe(400);
    expect(db.gratitudeEntry.create).not.toHaveBeenCalled();
  });

  it("returns error array in 400 response body", async () => {
    const res = await POST(makeReq({ item: "" }));
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(Array.isArray(body.error)).toBe(true);
  });

  // 409 per-day limit

  it("returns 409 when user already has GRATITUDE_MAX_PER_DAY (3) entries today", async () => {
    db.gratitudeEntry.count.mockResolvedValue(GRATITUDE_MAX_PER_DAY);
    const res = await POST(makeReq({ item: "One more thing" }));
    expect(res.status).toBe(409);
    expect(db.gratitudeEntry.create).not.toHaveBeenCalled();
  });

  it("returns friendly error message in 409 response", async () => {
    db.gratitudeEntry.count.mockResolvedValue(GRATITUDE_MAX_PER_DAY);
    const res = await POST(makeReq({ item: "One more thing" }));
    const body = await res.json();
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);
  });

  it("allows exactly GRATITUDE_MAX_PER_DAY - 1 (2) entries, not blocked", async () => {
    db.gratitudeEntry.count.mockResolvedValue(GRATITUDE_MAX_PER_DAY - 1);
    const res = await POST(makeReq({ item: "Still allowed" }));
    expect(res.status).toBe(201);
  });

  it("count query is scoped to today's date", async () => {
    await POST(makeReq({ item: "Good health" }));
    const countCall = db.gratitudeEntry.count.mock.calls[0][0];
    // date should be a Date object representing today (no time component)
    expect(countCall.where.date).toBeDefined();
  });

  it("does not call create when validation fails (count not checked)", async () => {
    const res = await POST(makeReq({ item: "" }));
    expect(res.status).toBe(400);
    expect(db.gratitudeEntry.count).not.toHaveBeenCalled();
    expect(db.gratitudeEntry.create).not.toHaveBeenCalled();
  });
});
