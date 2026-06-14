import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/mood/route";
import { prisma } from "@/lib/db";

const db = prisma as unknown as {
  moodLog: {
    findMany: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
};

const makeReq = (body: unknown) =>
  ({ json: async () => body } as unknown as Request);

const sampleLog = {
  id: "ml-1",
  userId: "user-1",
  date: new Date("2026-06-14T00:00:00Z"),
  mood: 4,
  note: "Feeling good",
  createdAt: new Date("2026-06-14T10:00:00Z"),
  updatedAt: new Date("2026-06-14T10:00:00Z"),
};

// ─── GET /api/mood ────────────────────────────────────────────────────────────

describe("GET /api/mood", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.moodLog.findMany.mockResolvedValue([]);
  });

  it("returns mood logs scoped to the authenticated user", async () => {
    db.moodLog.findMany.mockResolvedValue([sampleLog]);
    const res = await GET();
    expect(res.status).toBe(200);
    const call = db.moodLog.findMany.mock.calls[0][0];
    expect(call.where).toMatchObject({ userId: "user-1" });
  });

  it("returns an empty array when the user has no logs", async () => {
    db.moodLog.findMany.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("applies take: 30 limit", async () => {
    db.moodLog.findMany.mockResolvedValue([]);
    await GET();
    const call = db.moodLog.findMany.mock.calls[0][0];
    expect(call.take).toBe(30);
  });

  it("orders by date descending", async () => {
    db.moodLog.findMany.mockResolvedValue([]);
    await GET();
    const call = db.moodLog.findMany.mock.calls[0][0];
    expect(call.orderBy).toMatchObject({ date: "desc" });
  });

  it("returns all log fields in the response", async () => {
    db.moodLog.findMany.mockResolvedValue([sampleLog]);
    const res = await GET();
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ id: "ml-1", userId: "user-1", mood: 4 });
  });
});

// ─── POST /api/mood ───────────────────────────────────────────────────────────

describe("POST /api/mood", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.moodLog.upsert.mockResolvedValue(sampleLog);
  });

  // Happy-path

  it("creates a mood log with correct userId and returns 201", async () => {
    const res = await POST(makeReq({ mood: 4 }));
    expect(res.status).toBe(201);
    const call = db.moodLog.upsert.mock.calls[0][0];
    expect(call.create).toMatchObject({ userId: "user-1", mood: 4 });
  });

  it("persists optional note when provided", async () => {
    await POST(makeReq({ mood: 3, note: "Average day" }));
    const call = db.moodLog.upsert.mock.calls[0][0];
    expect(call.create.note).toBe("Average day");
    expect(call.update.note).toBe("Average day");
  });

  it("sets note to null when note is not provided", async () => {
    await POST(makeReq({ mood: 5 }));
    const call = db.moodLog.upsert.mock.calls[0][0];
    expect(call.create.note).toBeNull();
    expect(call.update.note).toBeNull();
  });

  it("returns the upserted log in the response body", async () => {
    const res = await POST(makeReq({ mood: 4, note: "Feeling good" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ id: "ml-1", mood: 4, note: "Feeling good" });
  });

  // Upsert behaviour

  it("uses upsert keyed on userId_date to prevent duplicate logs per day", async () => {
    await POST(makeReq({ mood: 3 }));
    const call = db.moodLog.upsert.mock.calls[0][0];
    expect(call.where).toMatchObject({ userId_date: { userId: "user-1" } });
    expect(call.where.userId_date).toHaveProperty("date");
  });

  it("updates mood and note on re-submission for the same day (upsert update branch)", async () => {
    await POST(makeReq({ mood: 5, note: "Updated" }));
    const call = db.moodLog.upsert.mock.calls[0][0];
    expect(call.update).toMatchObject({ mood: 5, note: "Updated" });
  });

  // Mood boundary validation

  it("returns 400 when mood is below 1", async () => {
    const res = await POST(makeReq({ mood: 0 }));
    expect(res.status).toBe(400);
    expect(db.moodLog.upsert).not.toHaveBeenCalled();
  });

  it("returns 400 when mood is above 5", async () => {
    const res = await POST(makeReq({ mood: 6 }));
    expect(res.status).toBe(400);
    expect(db.moodLog.upsert).not.toHaveBeenCalled();
  });

  it("returns 400 when mood is not an integer", async () => {
    const res = await POST(makeReq({ mood: 2.5 }));
    expect(res.status).toBe(400);
    expect(db.moodLog.upsert).not.toHaveBeenCalled();
  });

  it("returns 400 when mood is missing", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    expect(db.moodLog.upsert).not.toHaveBeenCalled();
  });

  it("returns 400 when mood is a string", async () => {
    const res = await POST(makeReq({ mood: "happy" }));
    expect(res.status).toBe(400);
    expect(db.moodLog.upsert).not.toHaveBeenCalled();
  });

  it("accepts mood at the minimum boundary (1)", async () => {
    const res = await POST(makeReq({ mood: 1 }));
    expect(res.status).toBe(201);
  });

  it("accepts mood at the maximum boundary (5)", async () => {
    const res = await POST(makeReq({ mood: 5 }));
    expect(res.status).toBe(201);
  });

  // Note validation

  it("returns 400 when note exceeds 500 characters", async () => {
    const res = await POST(makeReq({ mood: 3, note: "A".repeat(501) }));
    expect(res.status).toBe(400);
    expect(db.moodLog.upsert).not.toHaveBeenCalled();
  });

  it("accepts note at exactly 500 characters", async () => {
    const res = await POST(makeReq({ mood: 3, note: "A".repeat(500) }));
    expect(res.status).toBe(201);
  });

  it("includes error array in 400 response body", async () => {
    const res = await POST(makeReq({ mood: 0 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(Array.isArray(body.error)).toBe(true);
  });
});
