import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/dailywork/rollover/route";
import { prisma } from "@/lib/db";

const db = prisma as unknown as {
  user: { findMany: ReturnType<typeof vi.fn> };
  task: {
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

const makeReq = (secret: string | null) => {
  const headers = new Headers();
  if (secret !== null) headers.set("x-rollover-secret", secret);
  return { headers } as unknown as Request;
};

const ROLLOVER_SECRET = "test-rollover-secret";

describe("POST /api/dailywork/rollover (secret-guarded cron)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ROLLOVER_SECRET = ROLLOVER_SECRET;
    db.user.findMany.mockResolvedValue([]);
    db.task.findMany.mockResolvedValue([]);
    db.task.update.mockResolvedValue({});
  });

  // ─── Auth / secret checks ──────────────────────────────────────────────

  it("returns 401 when x-rollover-secret header is missing", async () => {
    const res = await POST(makeReq(null));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
    expect(db.user.findMany).not.toHaveBeenCalled();
  });

  it("returns 401 when x-rollover-secret header is wrong", async () => {
    const res = await POST(makeReq("wrong-secret"));
    expect(res.status).toBe(401);
    expect(db.user.findMany).not.toHaveBeenCalled();
  });

  it("returns 401 when ROLLOVER_SECRET env is not configured", async () => {
    delete process.env.ROLLOVER_SECRET;
    const res = await POST(makeReq(ROLLOVER_SECRET));
    expect(res.status).toBe(401);
  });

  // ─── Happy path ────────────────────────────────────────────────────────

  it("returns { moved: 0 } when no users have past pending tasks", async () => {
    db.user.findMany.mockResolvedValue([]);
    const res = await POST(makeReq(ROLLOVER_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.moved).toBe(0);
  });

  it("rolls over past incomplete tasks to today for each user", async () => {
    const pastDate = new Date("2026-05-28T00:00:00Z");
    const pastTask = { id: "t-1", originalDate: null, scheduledDate: pastDate };
    db.user.findMany.mockResolvedValue([{ id: "user-1", timezone: "UTC" }]);
    db.task.findMany.mockResolvedValue([pastTask]);
    db.task.update.mockResolvedValue({});

    const res = await POST(makeReq(ROLLOVER_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.moved).toBe(1);

    // Verify task was updated with rolledOver=true and scheduledDate set to today's start
    expect(db.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "t-1" },
        data: expect.objectContaining({
          rolledOver: true,
          originalDate: pastDate, // preserves original date on first rollover
          scheduledDate: expect.any(Date),
        }),
      })
    );
  });

  it("preserves existing originalDate on subsequent rollovers", async () => {
    const originalDate = new Date("2026-05-27T00:00:00Z");
    const scheduledDate = new Date("2026-05-28T00:00:00Z");
    const alreadyRolledTask = { id: "t-2", originalDate, scheduledDate };
    db.user.findMany.mockResolvedValue([{ id: "user-1", timezone: "UTC" }]);
    db.task.findMany.mockResolvedValue([alreadyRolledTask]);

    await POST(makeReq(ROLLOVER_SECRET));

    expect(db.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "t-2" },
        data: expect.objectContaining({
          originalDate, // keeps original, not the intermediate scheduledDate
        }),
      })
    );
  });

  it("counts moved tasks correctly across multiple users", async () => {
    db.user.findMany.mockResolvedValue([
      { id: "user-1", timezone: "UTC" },
      { id: "user-2", timezone: "UTC" },
    ]);
    const pastDate = new Date("2026-05-28T00:00:00Z");
    // Both users have 2 tasks each
    db.task.findMany
      .mockResolvedValueOnce([
        { id: "t-1", originalDate: null, scheduledDate: pastDate },
        { id: "t-2", originalDate: null, scheduledDate: pastDate },
      ])
      .mockResolvedValueOnce([
        { id: "t-3", originalDate: null, scheduledDate: pastDate },
      ]);
    db.task.update.mockResolvedValue({});

    const res = await POST(makeReq(ROLLOVER_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.moved).toBe(3);
  });
});
