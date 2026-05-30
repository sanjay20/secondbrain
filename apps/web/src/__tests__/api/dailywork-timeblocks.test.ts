import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/dailywork/timeblocks/route";
import { PATCH, DELETE } from "@/app/api/dailywork/timeblocks/[id]/route";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const mockRequireUser = requireUser as ReturnType<typeof vi.fn>;

const db = prisma as unknown as {
  timeBlock: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  calendarConnection: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

const makeReq = (body: unknown, url = "http://localhost/api/dailywork/timeblocks") =>
  ({ json: async () => body, url } as unknown as Request);

const makeReqWithUrl = (url: string) =>
  ({ url } as unknown as Request);

const makeCtx = (id: string) =>
  ({ params: Promise.resolve({ id }) } as { params: Promise<{ id: string }> });

const now = new Date("2026-05-30T09:00:00Z");
const later = new Date("2026-05-30T10:00:00Z");

const sampleBlock = {
  id: "tb-1",
  userId: "user-1",
  label: "Deep work",
  startTime: now,
  endTime: later,
  taskId: null,
  goalId: null,
  googleEventId: null,
  task: null,
};

// ─── GET /api/dailywork/timeblocks ────────────────────────────────────────

describe("GET /api/dailywork/timeblocks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.timeBlock.findMany.mockResolvedValue([]);
    db.calendarConnection.findUnique.mockResolvedValue(null);
    mockRequireUser.mockResolvedValue({ id: "user-1", email: "test@example.com", timezone: "UTC" });
  });

  it("returns time blocks for the authenticated user", async () => {
    db.timeBlock.findMany.mockResolvedValue([sampleBlock]);
    const res = await GET(makeReqWithUrl("http://localhost/api/dailywork/timeblocks"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(db.timeBlock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "user-1" }) })
    );
  });

  it("accepts a date query param and scopes the range", async () => {
    db.timeBlock.findMany.mockResolvedValue([sampleBlock]);
    const res = await GET(makeReqWithUrl("http://localhost/api/dailywork/timeblocks?date=2026-05-30"));
    expect(res.status).toBe(200);
    expect(db.timeBlock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1", startTime: expect.any(Object) }),
      })
    );
  });

  it("returns 401 when auth fails", async () => {
    mockRequireUser.mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }));
    await expect(GET(makeReqWithUrl("http://localhost/api/dailywork/timeblocks"))).rejects.toThrow();
  });
});

// ─── POST /api/dailywork/timeblocks ───────────────────────────────────────

describe("POST /api/dailywork/timeblocks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.timeBlock.create.mockResolvedValue(sampleBlock);
    db.timeBlock.findFirst.mockResolvedValue(null); // no overlap by default
    db.calendarConnection.findUnique.mockResolvedValue(null); // no GCal connection
    mockRequireUser.mockResolvedValue({ id: "user-1", email: "test@example.com", timezone: "UTC" });
  });

  it("creates a time block with correct userId", async () => {
    const res = await POST(
      makeReq({ label: "Deep work", startTime: now.toISOString(), endTime: later.toISOString() })
    );
    expect(res.status).toBe(201);
    expect(db.timeBlock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "user-1", label: "Deep work" }),
      })
    );
  });

  it("includes conflict=false when no overlap", async () => {
    db.timeBlock.findFirst.mockResolvedValue(null);
    const res = await POST(
      makeReq({ label: "Focused session", startTime: now.toISOString(), endTime: later.toISOString() })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.conflict).toBe(false);
  });

  it("includes conflict=true when overlapping block exists", async () => {
    db.timeBlock.findFirst.mockResolvedValue(sampleBlock);
    const res = await POST(
      makeReq({ label: "Overlap", startTime: now.toISOString(), endTime: later.toISOString() })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.conflict).toBe(true);
  });

  it("returns 400 when label is missing", async () => {
    const res = await POST(makeReq({ startTime: now.toISOString(), endTime: later.toISOString() }));
    expect(res.status).toBe(400);
    expect(db.timeBlock.create).not.toHaveBeenCalled();
  });

  it("returns 400 when startTime >= endTime", async () => {
    const res = await POST(
      makeReq({ label: "Invalid", startTime: later.toISOString(), endTime: now.toISOString() })
    );
    expect(res.status).toBe(400);
    expect(db.timeBlock.create).not.toHaveBeenCalled();
  });

  it("returns 400 when startTime is missing", async () => {
    const res = await POST(makeReq({ label: "No start", endTime: later.toISOString() }));
    expect(res.status).toBe(400);
    expect(db.timeBlock.create).not.toHaveBeenCalled();
  });

  it("returns 401 when auth fails", async () => {
    mockRequireUser.mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }));
    await expect(
      POST(makeReq({ label: "X", startTime: now.toISOString(), endTime: later.toISOString() }))
    ).rejects.toThrow();
  });
});

// ─── PATCH /api/dailywork/timeblocks/[id] ─────────────────────────────────

describe("PATCH /api/dailywork/timeblocks/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.timeBlock.findFirst.mockResolvedValue(sampleBlock);
    db.timeBlock.update.mockResolvedValue({ ...sampleBlock, label: "Updated" });
    mockRequireUser.mockResolvedValue({ id: "user-1", email: "test@example.com", timezone: "UTC" });
  });

  it("updates a time block label and verifies ownership", async () => {
    const res = await PATCH(makeReq({ label: "Updated" }), makeCtx("tb-1"));
    expect(res.status).toBe(200);
    expect(db.timeBlock.findFirst).toHaveBeenCalledWith({ where: { id: "tb-1", userId: "user-1" } });
    expect(db.timeBlock.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "tb-1" } })
    );
  });

  it("returns 404 when block not found or not owned", async () => {
    db.timeBlock.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq({ label: "X" }), makeCtx("missing"));
    expect(res.status).toBe(404);
    expect(db.timeBlock.update).not.toHaveBeenCalled();
  });

  it("returns 400 for empty patch body", async () => {
    const res = await PATCH(makeReq({}), makeCtx("tb-1"));
    expect(res.status).toBe(400);
    expect(db.timeBlock.update).not.toHaveBeenCalled();
  });

  it("returns 401 when auth fails", async () => {
    mockRequireUser.mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }));
    await expect(PATCH(makeReq({ label: "X" }), makeCtx("tb-1"))).rejects.toThrow();
  });
});

// ─── DELETE /api/dailywork/timeblocks/[id] ────────────────────────────────

describe("DELETE /api/dailywork/timeblocks/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.timeBlock.findFirst.mockResolvedValue(sampleBlock);
    db.timeBlock.delete.mockResolvedValue({});
    mockRequireUser.mockResolvedValue({ id: "user-1", email: "test@example.com", timezone: "UTC" });
  });

  it("deletes a time block scoped to userId", async () => {
    const res = await DELETE({} as Request, makeCtx("tb-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(db.timeBlock.findFirst).toHaveBeenCalledWith({ where: { id: "tb-1", userId: "user-1" } });
    expect(db.timeBlock.delete).toHaveBeenCalledWith({ where: { id: "tb-1" } });
  });

  it("returns 404 when block not found", async () => {
    db.timeBlock.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("missing"));
    expect(res.status).toBe(404);
    expect(db.timeBlock.delete).not.toHaveBeenCalled();
  });

  it("still deletes successfully even when GCal event deletion would be attempted (non-blocking)", async () => {
    db.timeBlock.findFirst.mockResolvedValue({ ...sampleBlock, googleEventId: "gcal-123" });
    const res = await DELETE({} as Request, makeCtx("tb-1"));
    expect(res.status).toBe(200);
    expect(db.timeBlock.delete).toHaveBeenCalledWith({ where: { id: "tb-1" } });
  });

  it("returns 401 when auth fails", async () => {
    mockRequireUser.mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }));
    await expect(DELETE({} as Request, makeCtx("tb-1"))).rejects.toThrow();
  });
});
