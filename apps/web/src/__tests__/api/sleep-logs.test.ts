import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/sleep-logs/route";
import { prisma } from "@/lib/db";
import { subDays, startOfDay } from "date-fns";
import {
  SLEEP_NOTE_MAX_LEN,
  SLEEP_PAGE_LIMIT,
  SLEEP_QUALITY_MIN,
  SLEEP_QUALITY_MAX,
  sleepDurationMinutes,
} from "@secondbrain/types";

const db = prisma as unknown as {
  sleepLog: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

// ─── helpers ──────────────────────────────────────────────────────────────────

const makeReq = (body: unknown, url = "http://localhost/api/sleep-logs") =>
  ({ json: async () => body, url } as unknown as Request);

const makeReqWithSkip = (skip: number) =>
  ({ json: async () => ({}), url: `http://localhost/api/sleep-logs?skip=${skip}` } as unknown as Request);

// Fixed ISO datetimes: 11 PM → 7 AM next day (480 min)
const START_TIME = "2026-07-01T23:00:00.000Z"; // 11 PM UTC
const END_TIME   = "2026-07-02T07:00:00.000Z"; // 7 AM UTC next day

const sampleSleepLog = {
  id: "sl-1",
  userId: "user-1",
  startTime: new Date(START_TIME),
  endTime: new Date(END_TIME),
  quality: 4,
  note: "Good sleep",
  createdAt: new Date("2026-07-01T23:00:00.000Z"),
  updatedAt: new Date("2026-07-01T23:00:00.000Z"),
};

// ─── GET /api/sleep-logs ──────────────────────────────────────────────────────

describe("GET /api/sleep-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: empty results
    db.sleepLog.findMany.mockResolvedValue([]);
    db.sleepLog.count.mockResolvedValue(0);
  });

  it("returns 200 with sleepLogs, total, weeklyAverageMinutes, weeklyCount", async () => {
    db.sleepLog.findMany.mockResolvedValue([sampleSleepLog]);
    db.sleepLog.count.mockResolvedValue(1);
    const res = await GET(makeReq(null));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("sleepLogs");
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("weeklyAverageMinutes");
    expect(body).toHaveProperty("weeklyCount");
  });

  it("scopes findMany (list) query to the authenticated userId", async () => {
    await GET(makeReq(null));
    // First findMany call is the list; second is the weekly window
    const listCall = db.sleepLog.findMany.mock.calls[0][0];
    expect(listCall.where).toMatchObject({ userId: "user-1" });
  });

  it("scopes count query to the authenticated userId", async () => {
    await GET(makeReq(null));
    const countCall = db.sleepLog.count.mock.calls[0][0];
    expect(countCall.where).toMatchObject({ userId: "user-1" });
  });

  it("applies take: SLEEP_PAGE_LIMIT on the list findMany", async () => {
    await GET(makeReq(null));
    const listCall = db.sleepLog.findMany.mock.calls[0][0];
    expect(listCall.take).toBe(SLEEP_PAGE_LIMIT);
    expect(listCall.take).toBe(20);
  });

  it("orders by startTime desc then createdAt desc (newest first)", async () => {
    await GET(makeReq(null));
    const listCall = db.sleepLog.findMany.mock.calls[0][0];
    expect(listCall.orderBy).toEqual([{ startTime: "desc" }, { createdAt: "desc" }]);
  });

  it("uses skip=0 by default", async () => {
    await GET(makeReq(null));
    const listCall = db.sleepLog.findMany.mock.calls[0][0];
    expect(listCall.skip).toBe(0);
  });

  it("uses the skip query param when provided", async () => {
    await GET(makeReqWithSkip(20));
    const listCall = db.sleepLog.findMany.mock.calls[0][0];
    expect(listCall.skip).toBe(20);
  });

  it("returns empty sleepLogs array and weeklyAverageMinutes 0 when no data", async () => {
    const res = await GET(makeReq(null));
    const body = await res.json();
    expect(body.sleepLogs).toEqual([]);
    expect(body.weeklyAverageMinutes).toBe(0);
    expect(body.weeklyCount).toBe(0);
    expect(body.total).toBe(0);
  });

  it("computes weeklyAverageMinutes correctly from weekly entries", async () => {
    // Two entries: 480 min each → average 480
    const entry1 = { ...sampleSleepLog, id: "sl-1" };
    const entry2 = { ...sampleSleepLog, id: "sl-2" };
    // First findMany (list) returns entries; second findMany (weekly) returns same
    db.sleepLog.findMany
      .mockResolvedValueOnce([entry1, entry2]) // list
      .mockResolvedValueOnce([entry1, entry2]); // weekly
    db.sleepLog.count.mockResolvedValue(2);

    const res = await GET(makeReq(null));
    const body = await res.json();
    expect(body.weeklyCount).toBe(2);
    // 480 min per entry, average = 480
    const expected = sleepDurationMinutes(sampleSleepLog.startTime, sampleSleepLog.endTime);
    expect(body.weeklyAverageMinutes).toBe(expected);
  });

  it("computes weeklyAverageMinutes as rounded integer", async () => {
    // Two entries with different durations: 480 + 360 = 840, average = 420
    const entry1 = { ...sampleSleepLog, id: "sl-1" };
    const entry2 = {
      ...sampleSleepLog,
      id: "sl-2",
      startTime: new Date("2026-07-01T23:00:00.000Z"),
      endTime: new Date("2026-07-02T05:00:00.000Z"), // 6h = 360 min
    };
    db.sleepLog.findMany
      .mockResolvedValueOnce([entry1, entry2])  // list
      .mockResolvedValueOnce([entry1, entry2]); // weekly
    db.sleepLog.count.mockResolvedValue(2);

    const res = await GET(makeReq(null));
    const body = await res.json();
    expect(body.weeklyAverageMinutes).toBe(420);
  });

  it("weekly findMany query has startTime gte filter covering last 7 days", async () => {
    await GET(makeReq(null));
    const weeklyCall = db.sleepLog.findMany.mock.calls[1][0];
    expect(weeklyCall.where).toMatchObject({ userId: "user-1" });
    expect(weeklyCall.where.startTime).toHaveProperty("gte");
    // The gte value should be approximately startOfDay(subDays(today, 6))
    const expected = startOfDay(subDays(new Date(), 6));
    const actual: Date = weeklyCall.where.startTime.gte;
    // Allow a 5-second window for test execution delay
    expect(Math.abs(actual.getTime() - expected.getTime())).toBeLessThan(5000);
  });

  it("returns sleepLogs list from findMany in response body", async () => {
    db.sleepLog.findMany
      .mockResolvedValueOnce([sampleSleepLog]) // list
      .mockResolvedValueOnce([sampleSleepLog]); // weekly
    db.sleepLog.count.mockResolvedValue(1);

    const res = await GET(makeReq(null));
    const body = await res.json();
    expect(body.sleepLogs).toHaveLength(1);
    expect(body.sleepLogs[0]).toMatchObject({ id: "sl-1" });
    expect(body.total).toBe(1);
  });
});

// ─── POST /api/sleep-logs ─────────────────────────────────────────────────────

describe("POST /api/sleep-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.sleepLog.create.mockResolvedValue(sampleSleepLog);
  });

  // Happy path

  it("creates a sleep log and returns 201 on valid input", async () => {
    const res = await POST(makeReq({ startTime: START_TIME, endTime: END_TIME }));
    expect(res.status).toBe(201);
  });

  it("persists the correct userId from auth", async () => {
    await POST(makeReq({ startTime: START_TIME, endTime: END_TIME }));
    const call = db.sleepLog.create.mock.calls[0][0];
    expect(call.data).toMatchObject({ userId: "user-1" });
  });

  it("persists startTime as a Date object", async () => {
    await POST(makeReq({ startTime: START_TIME, endTime: END_TIME }));
    const call = db.sleepLog.create.mock.calls[0][0];
    expect(call.data.startTime).toBeInstanceOf(Date);
    expect(call.data.startTime.toISOString()).toBe(START_TIME);
  });

  it("persists endTime as a Date object", async () => {
    await POST(makeReq({ startTime: START_TIME, endTime: END_TIME }));
    const call = db.sleepLog.create.mock.calls[0][0];
    expect(call.data.endTime).toBeInstanceOf(Date);
    expect(call.data.endTime.toISOString()).toBe(END_TIME);
  });

  it("returns the created sleep log in the response body", async () => {
    const res = await POST(makeReq({ startTime: START_TIME, endTime: END_TIME }));
    const body = await res.json();
    expect(body).toMatchObject({ id: "sl-1" });
  });

  it("persists optional quality when provided", async () => {
    await POST(makeReq({ startTime: START_TIME, endTime: END_TIME, quality: 4 }));
    const call = db.sleepLog.create.mock.calls[0][0];
    expect(call.data.quality).toBe(4);
  });

  it("persists optional note when provided", async () => {
    await POST(makeReq({ startTime: START_TIME, endTime: END_TIME, note: "Slept well" }));
    const call = db.sleepLog.create.mock.calls[0][0];
    expect(call.data.note).toBe("Slept well");
  });

  it("persists trimmed note", async () => {
    await POST(makeReq({ startTime: START_TIME, endTime: END_TIME, note: "  Great rest  " }));
    const call = db.sleepLog.create.mock.calls[0][0];
    expect(call.data.note).toBe("Great rest");
  });

  it("accepts quality=1 (minimum) → 201", async () => {
    const res = await POST(makeReq({ startTime: START_TIME, endTime: END_TIME, quality: SLEEP_QUALITY_MIN }));
    expect(res.status).toBe(201);
  });

  it("accepts quality=5 (maximum) → 201", async () => {
    const res = await POST(makeReq({ startTime: START_TIME, endTime: END_TIME, quality: SLEEP_QUALITY_MAX }));
    expect(res.status).toBe(201);
  });

  it("accepts note of exactly SLEEP_NOTE_MAX_LEN characters → 201", async () => {
    const res = await POST(makeReq({
      startTime: START_TIME,
      endTime: END_TIME,
      note: "N".repeat(SLEEP_NOTE_MAX_LEN),
    }));
    expect(res.status).toBe(201);
  });

  // Zod validation — endTime <= startTime

  it("returns 400 when endTime equals startTime", async () => {
    const res = await POST(makeReq({ startTime: START_TIME, endTime: START_TIME }));
    expect(res.status).toBe(400);
    expect(db.sleepLog.create).not.toHaveBeenCalled();
  });

  it("returns 400 when endTime is before startTime", async () => {
    const res = await POST(makeReq({
      startTime: END_TIME,    // reversed: end used as start
      endTime: START_TIME,    // and start used as end
    }));
    expect(res.status).toBe(400);
    expect(db.sleepLog.create).not.toHaveBeenCalled();
  });

  // Zod validation — quality field

  it("returns 400 when quality is 0 (below minimum)", async () => {
    const res = await POST(makeReq({ startTime: START_TIME, endTime: END_TIME, quality: 0 }));
    expect(res.status).toBe(400);
    expect(db.sleepLog.create).not.toHaveBeenCalled();
  });

  it("returns 400 when quality is 6 (above maximum)", async () => {
    const res = await POST(makeReq({ startTime: START_TIME, endTime: END_TIME, quality: 6 }));
    expect(res.status).toBe(400);
    expect(db.sleepLog.create).not.toHaveBeenCalled();
  });

  it("returns 400 when quality is a float", async () => {
    const res = await POST(makeReq({ startTime: START_TIME, endTime: END_TIME, quality: 3.5 }));
    expect(res.status).toBe(400);
    expect(db.sleepLog.create).not.toHaveBeenCalled();
  });

  // Zod validation — note field

  it(`returns 400 when note exceeds SLEEP_NOTE_MAX_LEN (${SLEEP_NOTE_MAX_LEN}) characters`, async () => {
    const res = await POST(makeReq({
      startTime: START_TIME,
      endTime: END_TIME,
      note: "N".repeat(SLEEP_NOTE_MAX_LEN + 1),
    }));
    expect(res.status).toBe(400);
    expect(db.sleepLog.create).not.toHaveBeenCalled();
  });

  // Zod validation — required fields

  it("returns 400 when startTime is missing", async () => {
    const res = await POST(makeReq({ endTime: END_TIME }));
    expect(res.status).toBe(400);
    expect(db.sleepLog.create).not.toHaveBeenCalled();
  });

  it("returns 400 when endTime is missing", async () => {
    const res = await POST(makeReq({ startTime: START_TIME }));
    expect(res.status).toBe(400);
    expect(db.sleepLog.create).not.toHaveBeenCalled();
  });

  it("returns 400 when startTime is not a valid ISO datetime", async () => {
    const res = await POST(makeReq({ startTime: "not-a-date", endTime: END_TIME }));
    expect(res.status).toBe(400);
    expect(db.sleepLog.create).not.toHaveBeenCalled();
  });

  // ZodError response shape

  it("returns error array in the 400 response body", async () => {
    const res = await POST(makeReq({ startTime: START_TIME, endTime: START_TIME }));
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(Array.isArray(body.error)).toBe(true);
  });

  it("does not call create when ZodError is thrown", async () => {
    await POST(makeReq({ startTime: START_TIME, endTime: START_TIME }));
    expect(db.sleepLog.create).not.toHaveBeenCalled();
  });
});
