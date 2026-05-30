import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/dailywork/tasks/route";
import { PATCH, DELETE } from "@/app/api/dailywork/tasks/[id]/route";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const mockRequireUser = requireUser as ReturnType<typeof vi.fn>;

const db = prisma as unknown as {
  task: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

const makeReq = (body: unknown, url = "http://localhost/api/dailywork/tasks") =>
  ({ json: async () => body, url } as unknown as Request);

const makeReqWithUrl = (url: string) =>
  ({ url } as unknown as Request);

const makeCtx = (id: string) =>
  ({ params: Promise.resolve({ id }) } as { params: Promise<{ id: string }> });

const sampleTask = {
  id: "t-1",
  userId: "user-1",
  title: "Write tests",
  notes: null,
  pillar: "work",
  status: "todo",
  priority: "medium",
  scheduledDate: new Date("2026-05-30"),
  completedAt: null,
  rolledOver: false,
  originalDate: null,
};

// ─── GET /api/dailywork/tasks ──────────────────────────────────────────────

describe("GET /api/dailywork/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.task.findMany.mockResolvedValue([]);
    mockRequireUser.mockResolvedValue({ id: "user-1", email: "test@example.com", timezone: "UTC" });
  });

  it("returns tasks for the authenticated user (today view)", async () => {
    db.task.findMany.mockResolvedValue([sampleTask]);
    const res = await GET(makeReqWithUrl("http://localhost/api/dailywork/tasks?view=today"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(db.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "user-1" }) })
    );
  });

  it("returns tasks for upcoming view", async () => {
    db.task.findMany.mockResolvedValue([sampleTask]);
    const res = await GET(makeReqWithUrl("http://localhost/api/dailywork/tasks?view=upcoming"));
    expect(res.status).toBe(200);
    expect(db.task.findMany).toHaveBeenCalled();
  });

  it("returns tasks for completed view", async () => {
    db.task.findMany.mockResolvedValue([{ ...sampleTask, completedAt: new Date(), status: "done" }]);
    const res = await GET(makeReqWithUrl("http://localhost/api/dailywork/tasks?view=completed"));
    expect(res.status).toBe(200);
    expect(db.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ completedAt: { not: null } }),
      })
    );
  });

  it("filters by pillar when provided", async () => {
    db.task.findMany.mockResolvedValue([sampleTask]);
    const res = await GET(makeReqWithUrl("http://localhost/api/dailywork/tasks?pillar=work"));
    expect(res.status).toBe(200);
    expect(db.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ pillar: "work" }) })
    );
  });

  it("returns 401 when auth fails", async () => {
    mockRequireUser.mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }));
    await expect(GET(makeReqWithUrl("http://localhost/api/dailywork/tasks"))).rejects.toThrow();
  });
});

// ─── POST /api/dailywork/tasks ─────────────────────────────────────────────

describe("POST /api/dailywork/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.task.create.mockResolvedValue(sampleTask);
    mockRequireUser.mockResolvedValue({ id: "user-1", email: "test@example.com", timezone: "UTC" });
  });

  it("creates a task with correct userId and fields", async () => {
    const res = await POST(
      makeReq({ title: "Write tests", scheduledDate: "2026-05-30", priority: "high", pillar: "work" })
    );
    expect(res.status).toBe(201);
    expect(db.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "user-1", title: "Write tests" }),
      })
    );
  });

  it("defaults status to todo and priority to medium", async () => {
    await POST(makeReq({ title: "Quick task", scheduledDate: "2026-05-30" }));
    const call = db.task.create.mock.calls[0][0];
    expect(call.data.status).toBe("todo");
    expect(call.data.priority).toBe("medium");
  });

  it("returns 400 when title is missing", async () => {
    const res = await POST(makeReq({ scheduledDate: "2026-05-30" }));
    expect(res.status).toBe(400);
    expect(db.task.create).not.toHaveBeenCalled();
  });

  it("returns 400 when scheduledDate is missing", async () => {
    const res = await POST(makeReq({ title: "No date task" }));
    expect(res.status).toBe(400);
    expect(db.task.create).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid priority value", async () => {
    const res = await POST(makeReq({ title: "Bad priority", scheduledDate: "2026-05-30", priority: "urgent" }));
    expect(res.status).toBe(400);
    expect(db.task.create).not.toHaveBeenCalled();
  });

  it("returns 400 when title exceeds 200 chars", async () => {
    const res = await POST(makeReq({ title: "x".repeat(201), scheduledDate: "2026-05-30" }));
    expect(res.status).toBe(400);
    expect(db.task.create).not.toHaveBeenCalled();
  });

  it("returns 401 when auth fails", async () => {
    mockRequireUser.mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }));
    await expect(POST(makeReq({ title: "Task", scheduledDate: "2026-05-30" }))).rejects.toThrow();
  });
});

// ─── PATCH /api/dailywork/tasks/[id] ──────────────────────────────────────

describe("PATCH /api/dailywork/tasks/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.task.findFirst.mockResolvedValue(sampleTask);
    db.task.update.mockResolvedValue({ ...sampleTask, status: "in_progress" });
    mockRequireUser.mockResolvedValue({ id: "user-1", email: "test@example.com", timezone: "UTC" });
  });

  it("updates task fields and verifies ownership via userId", async () => {
    const res = await PATCH(makeReq({ status: "in_progress" }), makeCtx("t-1"));
    expect(res.status).toBe(200);
    expect(db.task.findFirst).toHaveBeenCalledWith({ where: { id: "t-1", userId: "user-1" } });
    expect(db.task.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "t-1" } })
    );
  });

  it("stamps completedAt when status is set to done", async () => {
    db.task.update.mockResolvedValue({ ...sampleTask, status: "done", completedAt: new Date() });
    await PATCH(makeReq({ status: "done" }), makeCtx("t-1"));
    const call = db.task.update.mock.calls[0][0];
    expect(call.data.completedAt).toBeInstanceOf(Date);
  });

  it("clears completedAt when status reverts from done", async () => {
    db.task.findFirst.mockResolvedValue({ ...sampleTask, completedAt: new Date(), status: "done" });
    db.task.update.mockResolvedValue({ ...sampleTask, status: "todo", completedAt: null });
    await PATCH(makeReq({ status: "todo" }), makeCtx("t-1"));
    const call = db.task.update.mock.calls[0][0];
    expect(call.data.completedAt).toBeNull();
  });

  it("returns 404 when task not found or not owned by user", async () => {
    db.task.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq({ status: "done" }), makeCtx("missing"));
    expect(res.status).toBe(404);
    expect(db.task.update).not.toHaveBeenCalled();
  });

  it("returns 400 for an empty patch body", async () => {
    const res = await PATCH(makeReq({}), makeCtx("t-1"));
    expect(res.status).toBe(400);
    expect(db.task.update).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid status value", async () => {
    const res = await PATCH(makeReq({ status: "cancelled" }), makeCtx("t-1"));
    expect(res.status).toBe(400);
    expect(db.task.update).not.toHaveBeenCalled();
  });

  it("returns 401 when auth fails", async () => {
    mockRequireUser.mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }));
    await expect(PATCH(makeReq({ status: "done" }), makeCtx("t-1"))).rejects.toThrow();
  });
});

// ─── DELETE /api/dailywork/tasks/[id] ─────────────────────────────────────

describe("DELETE /api/dailywork/tasks/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.task.findFirst.mockResolvedValue(sampleTask);
    db.task.delete.mockResolvedValue({});
    mockRequireUser.mockResolvedValue({ id: "user-1", email: "test@example.com", timezone: "UTC" });
  });

  it("deletes task scoped to userId", async () => {
    const res = await DELETE({} as Request, makeCtx("t-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(db.task.findFirst).toHaveBeenCalledWith({ where: { id: "t-1", userId: "user-1" } });
    expect(db.task.delete).toHaveBeenCalledWith({ where: { id: "t-1" } });
  });

  it("returns 404 when task not found", async () => {
    db.task.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("missing"));
    expect(res.status).toBe(404);
    expect(db.task.delete).not.toHaveBeenCalled();
  });

  it("returns 401 when auth fails", async () => {
    mockRequireUser.mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }));
    await expect(DELETE({} as Request, makeCtx("t-1"))).rejects.toThrow();
  });
});
