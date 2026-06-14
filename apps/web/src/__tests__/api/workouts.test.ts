import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/workouts/route";
import { prisma } from "@/lib/db";
import { startOfWeek, endOfWeek, addDays, subDays } from "date-fns";
import {
  WORKOUT_TYPE_MAX_LEN,
  WORKOUT_NOTES_MAX_LEN,
  WORKOUT_PAGE_LIMIT,
} from "@secondbrain/types";

const db = prisma as unknown as {
  workout: {
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
const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
const todayStr = todayMidnight.toISOString().slice(0, 10);

const sampleWorkout = {
  id: "wo-1",
  userId: "user-1",
  type: "Running",
  duration: 30,
  notes: "Felt great",
  date: todayMidnight,
  createdAt: todayMidnight,
};

// ─── GET /api/workouts ────────────────────────────────────────────────────────

describe("GET /api/workouts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.workout.findMany.mockResolvedValue([]);
    db.workout.count.mockResolvedValue(0);
  });

  it("returns 200 with workouts and weeklyCount", async () => {
    db.workout.findMany.mockResolvedValue([sampleWorkout]);
    db.workout.count.mockResolvedValue(1);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("workouts");
    expect(body).toHaveProperty("weeklyCount");
  });

  it("scopes findMany query to the authenticated userId", async () => {
    await GET();
    const findManyCall = db.workout.findMany.mock.calls[0][0];
    expect(findManyCall.where).toMatchObject({ userId: "user-1" });
  });

  it("scopes count query to the authenticated userId", async () => {
    await GET();
    const countCall = db.workout.count.mock.calls[0][0];
    expect(countCall.where).toMatchObject({ userId: "user-1" });
  });

  it("applies take: WORKOUT_PAGE_LIMIT (50) cap on findMany", async () => {
    await GET();
    const findManyCall = db.workout.findMany.mock.calls[0][0];
    expect(findManyCall.take).toBe(WORKOUT_PAGE_LIMIT);
    expect(findManyCall.take).toBe(50);
  });

  it("orders by date desc, then createdAt desc (newest first)", async () => {
    await GET();
    const findManyCall = db.workout.findMany.mock.calls[0][0];
    expect(findManyCall.orderBy).toEqual([{ date: "desc" }, { createdAt: "desc" }]);
  });

  it("returns empty workouts array and weeklyCount 0 when no data", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.workouts).toEqual([]);
    expect(body.weeklyCount).toBe(0);
  });

  it("weekly count query uses weekStartsOn:1 (Mon–Sun window)", async () => {
    await GET();
    const countCall = db.workout.count.mock.calls[0][0];
    const weekStart = startOfWeek(todayMidnight, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(todayMidnight, { weekStartsOn: 1 });
    // Allow 1-second tolerance for test clock drift
    expect(countCall.where.date.gte.getTime()).toBeCloseTo(weekStart.getTime(), -3);
    expect(countCall.where.date.lte.getTime()).toBeCloseTo(weekEnd.getTime(), -3);
  });

  it("weekly count includes Monday as first day of week", async () => {
    await GET();
    const countCall = db.workout.count.mock.calls[0][0];
    const weekStart: Date = countCall.where.date.gte;
    // Monday = day 1 in JS (0=Sun, 1=Mon)
    expect(weekStart.getDay()).toBe(1);
  });

  it("weekly count ends on Sunday (weekStartsOn:1 → Sunday is end)", async () => {
    await GET();
    const countCall = db.workout.count.mock.calls[0][0];
    const weekEnd: Date = countCall.where.date.lte;
    // Sunday = 0 in JS
    expect(weekEnd.getDay()).toBe(0);
  });

  it("weekly count window is exactly 7 days wide", async () => {
    await GET();
    const countCall = db.workout.count.mock.calls[0][0];
    const diffMs = countCall.where.date.lte.getTime() - countCall.where.date.gte.getTime();
    // endOfWeek sets time to 23:59:59.999 and startOfWeek to 00:00:00.000
    // Difference should be close to 7 * 24 * 60 * 60 * 1000 - 1 ms
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(diffMs).toBeLessThan(sevenDaysMs);
    expect(diffMs).toBeGreaterThan(sevenDaysMs - 2000); // within 2 seconds
  });

  it("returns workouts list from findMany in response body", async () => {
    db.workout.findMany.mockResolvedValue([sampleWorkout]);
    db.workout.count.mockResolvedValue(3);
    const res = await GET();
    const body = await res.json();
    expect(body.workouts).toHaveLength(1);
    expect(body.workouts[0]).toMatchObject({ id: "wo-1", type: "Running" });
    expect(body.weeklyCount).toBe(3);
  });

  // ─── Weekly count boundary date tests ─────────────────────────────────────

  it("boundary: Monday of current week is INSIDE the count window", async () => {
    await GET();
    const countCall = db.workout.count.mock.calls[0][0];
    const weekStart: Date = countCall.where.date.gte;
    // Monday itself should be >= weekStart (it IS weekStart)
    const monday = startOfWeek(todayMidnight, { weekStartsOn: 1 });
    expect(monday.getTime()).toBeGreaterThanOrEqual(weekStart.getTime());
    expect(monday.getTime()).toBeLessThanOrEqual(countCall.where.date.lte.getTime());
  });

  it("boundary: Sunday of current week is INSIDE the count window", async () => {
    await GET();
    const countCall = db.workout.count.mock.calls[0][0];
    const sunday = endOfWeek(todayMidnight, { weekStartsOn: 1 });
    expect(sunday.getTime()).toBeLessThanOrEqual(countCall.where.date.lte.getTime() + 1000);
    expect(sunday.getTime()).toBeGreaterThanOrEqual(countCall.where.date.gte.getTime());
  });
});

// ─── POST /api/workouts ───────────────────────────────────────────────────────

describe("POST /api/workouts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.workout.create.mockResolvedValue(sampleWorkout);
  });

  // Happy path

  it("creates a workout and returns 201 on valid input", async () => {
    const res = await POST(makeReq({ type: "Running", duration: 30 }));
    expect(res.status).toBe(201);
  });

  it("persists the correct userId from auth", async () => {
    await POST(makeReq({ type: "Cycling", duration: 45 }));
    const call = db.workout.create.mock.calls[0][0];
    expect(call.data).toMatchObject({ userId: "user-1" });
  });

  it("persists the trimmed type field", async () => {
    await POST(makeReq({ type: "  Yoga  ", duration: 60 }));
    const call = db.workout.create.mock.calls[0][0];
    expect(call.data.type).toBe("Yoga");
  });

  it("persists the duration as provided", async () => {
    await POST(makeReq({ type: "Swimming", duration: 45 }));
    const call = db.workout.create.mock.calls[0][0];
    expect(call.data.duration).toBe(45);
  });

  it("returns the created workout in the response body", async () => {
    const res = await POST(makeReq({ type: "Running", duration: 30 }));
    const body = await res.json();
    expect(body).toMatchObject({ id: "wo-1", type: "Running", duration: 30 });
  });

  it("defaults date to today when date field is omitted", async () => {
    await POST(makeReq({ type: "Running", duration: 30 }));
    const call = db.workout.create.mock.calls[0][0];
    const storedDate: Date = call.data.date;
    expect(storedDate.getFullYear()).toBe(todayMidnight.getFullYear());
    expect(storedDate.getMonth()).toBe(todayMidnight.getMonth());
    expect(storedDate.getDate()).toBe(todayMidnight.getDate());
  });

  it("stores date with no time component (date-only normalisation)", async () => {
    await POST(makeReq({ type: "Running", duration: 30, date: "2026-06-10" }));
    const call = db.workout.create.mock.calls[0][0];
    const storedDate: Date = call.data.date;
    // Time portion should be zeroed by resolveDate()
    expect(storedDate.getHours()).toBe(0);
    expect(storedDate.getMinutes()).toBe(0);
    expect(storedDate.getSeconds()).toBe(0);
    expect(storedDate.getMilliseconds()).toBe(0);
  });

  it("accepts an explicit date string and stores the correct date", async () => {
    await POST(makeReq({ type: "Running", duration: 30, date: "2026-06-10" }));
    const call = db.workout.create.mock.calls[0][0];
    const storedDate: Date = call.data.date;
    expect(storedDate.getFullYear()).toBe(2026);
    expect(storedDate.getMonth()).toBe(5); // June = 5 (0-indexed)
    expect(storedDate.getDate()).toBe(10);
  });

  it("persists optional notes when provided", async () => {
    await POST(makeReq({ type: "Running", duration: 30, notes: "Great run" }));
    const call = db.workout.create.mock.calls[0][0];
    expect(call.data.notes).toBe("Great run");
  });

  it("persists trimmed notes", async () => {
    await POST(makeReq({ type: "Running", duration: 30, notes: "  Good session  " }));
    const call = db.workout.create.mock.calls[0][0];
    expect(call.data.notes).toBe("Good session");
  });

  it("omits notes field when not provided", async () => {
    await POST(makeReq({ type: "Running", duration: 30 }));
    const call = db.workout.create.mock.calls[0][0];
    expect(call.data.notes).toBeUndefined();
  });

  // Boundary values → 201

  it("accepts type of exactly WORKOUT_TYPE_MAX_LEN (50) characters → 201", async () => {
    const res = await POST(makeReq({ type: "A".repeat(WORKOUT_TYPE_MAX_LEN), duration: 1 }));
    expect(res.status).toBe(201);
  });

  it("accepts duration of 1 (minimum positive integer) → 201", async () => {
    const res = await POST(makeReq({ type: "Yoga", duration: 1 }));
    expect(res.status).toBe(201);
  });

  it("accepts notes of exactly WORKOUT_NOTES_MAX_LEN (500) characters → 201", async () => {
    const res = await POST(makeReq({
      type: "Running",
      duration: 30,
      notes: "B".repeat(WORKOUT_NOTES_MAX_LEN),
    }));
    expect(res.status).toBe(201);
  });

  // Zod validation — type field

  it("returns 400 when type is empty string", async () => {
    const res = await POST(makeReq({ type: "", duration: 30 }));
    expect(res.status).toBe(400);
    expect(db.workout.create).not.toHaveBeenCalled();
  });

  it("returns 400 when type is whitespace only (fails min:1 after trim)", async () => {
    const res = await POST(makeReq({ type: "   ", duration: 30 }));
    expect(res.status).toBe(400);
    expect(db.workout.create).not.toHaveBeenCalled();
  });

  it(`returns 400 when type exceeds WORKOUT_TYPE_MAX_LEN (${WORKOUT_TYPE_MAX_LEN}) characters`, async () => {
    const res = await POST(makeReq({ type: "A".repeat(WORKOUT_TYPE_MAX_LEN + 1), duration: 30 }));
    expect(res.status).toBe(400);
    expect(db.workout.create).not.toHaveBeenCalled();
  });

  it("returns 400 when type field is missing", async () => {
    const res = await POST(makeReq({ duration: 30 }));
    expect(res.status).toBe(400);
    expect(db.workout.create).not.toHaveBeenCalled();
  });

  // Zod validation — duration field

  it("returns 400 when duration is 0 (not positive)", async () => {
    const res = await POST(makeReq({ type: "Running", duration: 0 }));
    expect(res.status).toBe(400);
    expect(db.workout.create).not.toHaveBeenCalled();
  });

  it("returns 400 when duration is negative", async () => {
    const res = await POST(makeReq({ type: "Running", duration: -5 }));
    expect(res.status).toBe(400);
    expect(db.workout.create).not.toHaveBeenCalled();
  });

  it("returns 400 when duration is a float (not integer)", async () => {
    const res = await POST(makeReq({ type: "Running", duration: 30.5 }));
    expect(res.status).toBe(400);
    expect(db.workout.create).not.toHaveBeenCalled();
  });

  it("returns 400 when duration is a non-numeric string", async () => {
    const res = await POST(makeReq({ type: "Running", duration: "thirty" }));
    expect(res.status).toBe(400);
    expect(db.workout.create).not.toHaveBeenCalled();
  });

  it("returns 400 when duration field is missing", async () => {
    const res = await POST(makeReq({ type: "Running" }));
    expect(res.status).toBe(400);
    expect(db.workout.create).not.toHaveBeenCalled();
  });

  // Zod validation — notes field

  it(`returns 400 when notes exceeds WORKOUT_NOTES_MAX_LEN (${WORKOUT_NOTES_MAX_LEN}) characters`, async () => {
    const res = await POST(makeReq({
      type: "Running",
      duration: 30,
      notes: "N".repeat(WORKOUT_NOTES_MAX_LEN + 1),
    }));
    expect(res.status).toBe(400);
    expect(db.workout.create).not.toHaveBeenCalled();
  });

  // ZodError response shape

  it("returns error array in the 400 response body", async () => {
    const res = await POST(makeReq({ type: "", duration: 30 }));
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(Array.isArray(body.error)).toBe(true);
  });

  it("does not call create when ZodError is thrown", async () => {
    await POST(makeReq({ type: "", duration: 30 }));
    expect(db.workout.create).not.toHaveBeenCalled();
  });
});
