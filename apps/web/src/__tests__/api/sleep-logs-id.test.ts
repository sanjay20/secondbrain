import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH, DELETE } from "@/app/api/sleep-logs/[id]/route";
import { prisma } from "@/lib/db";
import {
  SLEEP_NOTE_MAX_LEN,
  SLEEP_QUALITY_MIN,
  SLEEP_QUALITY_MAX,
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

const makeReq = (body: unknown) =>
  ({ json: async () => body } as unknown as Request);

const makeCtx = (id: string) =>
  ({ params: Promise.resolve({ id }) } as { params: Promise<{ id: string }> });

const START_TIME = "2026-07-01T23:00:00.000Z";
const END_TIME   = "2026-07-02T07:00:00.000Z";
const NEW_END    = "2026-07-02T06:00:00.000Z"; // shorter sleep for PATCH tests

const sampleSleepLog = {
  id: "sl-1",
  userId: "user-1",
  startTime: new Date(START_TIME),
  endTime: new Date(END_TIME),
  quality: 4,
  note: "Good sleep",
  createdAt: new Date(START_TIME),
  updatedAt: new Date(START_TIME),
};

// ─── DELETE /api/sleep-logs/[id] ─────────────────────────────────────────────

describe("DELETE /api/sleep-logs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.sleepLog.findFirst.mockResolvedValue(sampleSleepLog);
    db.sleepLog.delete.mockResolvedValue(sampleSleepLog);
  });

  // Happy path

  it("deletes the sleep log and returns 200 with { success: true }", async () => {
    const res = await DELETE({} as Request, makeCtx("sl-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  it("looks up the entry by both id AND userId (ownership check)", async () => {
    await DELETE({} as Request, makeCtx("sl-1"));
    expect(db.sleepLog.findFirst).toHaveBeenCalledWith({
      where: { id: "sl-1", userId: "user-1" },
    });
  });

  it("calls delete with the correct id after ownership is confirmed", async () => {
    await DELETE({} as Request, makeCtx("sl-1"));
    expect(db.sleepLog.delete).toHaveBeenCalledWith({ where: { id: "sl-1" } });
  });

  it("delete is called exactly once on success", async () => {
    await DELETE({} as Request, makeCtx("sl-1"));
    expect(db.sleepLog.delete).toHaveBeenCalledTimes(1);
  });

  // 404 — not found or wrong user

  it("returns 404 when sleep log does not exist", async () => {
    db.sleepLog.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("nonexistent"));
    expect(res.status).toBe(404);
    expect(db.sleepLog.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when sleep log belongs to a different user (ownership check via findFirst scope)", async () => {
    // findFirst returns null because userId doesn't match
    db.sleepLog.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("sl-other-user"));
    expect(res.status).toBe(404);
    expect(db.sleepLog.delete).not.toHaveBeenCalled();
  });

  it("returns an error body on 404", async () => {
    db.sleepLog.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("missing"));
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body.error).toBeTruthy();
  });

  it("does not call delete when findFirst returns null", async () => {
    db.sleepLog.findFirst.mockResolvedValue(null);
    await DELETE({} as Request, makeCtx("ghost"));
    expect(db.sleepLog.delete).not.toHaveBeenCalled();
  });

  it("uses the id from route params in the findFirst query", async () => {
    await DELETE({} as Request, makeCtx("some-specific-id"));
    const findFirstCall = db.sleepLog.findFirst.mock.calls[0][0];
    expect(findFirstCall.where.id).toBe("some-specific-id");
  });
});

// ─── PATCH /api/sleep-logs/[id] ──────────────────────────────────────────────

describe("PATCH /api/sleep-logs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.sleepLog.findFirst.mockResolvedValue(sampleSleepLog);
    db.sleepLog.update.mockResolvedValue({ ...sampleSleepLog, endTime: new Date(NEW_END) });
  });

  // Happy path

  it("updates sleep log and returns 200 on valid input", async () => {
    const res = await PATCH(makeReq({ endTime: NEW_END }), makeCtx("sl-1"));
    expect(res.status).toBe(200);
  });

  it("returns the updated sleep log in the response body", async () => {
    const res = await PATCH(makeReq({ endTime: NEW_END }), makeCtx("sl-1"));
    const body = await res.json();
    expect(body).toHaveProperty("id", "sl-1");
  });

  it("performs ownership check before calling update", async () => {
    await PATCH(makeReq({ endTime: NEW_END }), makeCtx("sl-1"));
    // findFirst must be called before update
    expect(db.sleepLog.findFirst).toHaveBeenCalledTimes(1);
    expect(db.sleepLog.update).toHaveBeenCalledTimes(1);
    const findFirstOrder = db.sleepLog.findFirst.mock.invocationCallOrder[0];
    const updateOrder    = db.sleepLog.update.mock.invocationCallOrder[0];
    expect(findFirstOrder).toBeLessThan(updateOrder);
  });

  it("looks up by both id AND userId (ownership check)", async () => {
    await PATCH(makeReq({ endTime: NEW_END }), makeCtx("sl-1"));
    expect(db.sleepLog.findFirst).toHaveBeenCalledWith({
      where: { id: "sl-1", userId: "user-1" },
    });
  });

  it("calls update with the correct id", async () => {
    await PATCH(makeReq({ endTime: NEW_END }), makeCtx("sl-1"));
    const updateCall = db.sleepLog.update.mock.calls[0][0];
    expect(updateCall.where).toEqual({ id: "sl-1" });
  });

  it("updates only the fields provided (partial update)", async () => {
    await PATCH(makeReq({ endTime: NEW_END }), makeCtx("sl-1"));
    const updateCall = db.sleepLog.update.mock.calls[0][0];
    // endTime should be updated; startTime should NOT be in data since not provided
    expect(updateCall.data).toHaveProperty("endTime");
    expect(updateCall.data).not.toHaveProperty("startTime");
  });

  it("updates endTime as a Date object", async () => {
    await PATCH(makeReq({ endTime: NEW_END }), makeCtx("sl-1"));
    const updateCall = db.sleepLog.update.mock.calls[0][0];
    expect(updateCall.data.endTime).toBeInstanceOf(Date);
  });

  it("can update quality to a new value", async () => {
    await PATCH(makeReq({ quality: 2 }), makeCtx("sl-1"));
    const updateCall = db.sleepLog.update.mock.calls[0][0];
    expect(updateCall.data.quality).toBe(2);
  });

  it("can clear quality by setting it to null", async () => {
    await PATCH(makeReq({ quality: null }), makeCtx("sl-1"));
    const updateCall = db.sleepLog.update.mock.calls[0][0];
    expect(updateCall.data.quality).toBeNull();
  });

  it("can clear note by setting it to null", async () => {
    await PATCH(makeReq({ note: null }), makeCtx("sl-1"));
    const updateCall = db.sleepLog.update.mock.calls[0][0];
    expect(updateCall.data.note).toBeNull();
  });

  it("trims the note field on update", async () => {
    await PATCH(makeReq({ note: "  Updated note  " }), makeCtx("sl-1"));
    const updateCall = db.sleepLog.update.mock.calls[0][0];
    expect(updateCall.data.note).toBe("Updated note");
  });

  // 404 — ownership failures

  it("returns 404 when entry does not exist", async () => {
    db.sleepLog.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq({ endTime: NEW_END }), makeCtx("nonexistent"));
    expect(res.status).toBe(404);
    expect(db.sleepLog.update).not.toHaveBeenCalled();
  });

  it("returns 404 when entry belongs to a different user", async () => {
    db.sleepLog.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq({ endTime: NEW_END }), makeCtx("sl-other-user"));
    expect(res.status).toBe(404);
    expect(db.sleepLog.update).not.toHaveBeenCalled();
  });

  // 400 — endTime <= startTime validation

  it("returns 400 when new endTime is before existing startTime", async () => {
    // existing startTime = 2026-07-01T23:00:00Z
    // sending endTime before that
    const res = await PATCH(makeReq({ endTime: "2026-07-01T22:00:00.000Z" }), makeCtx("sl-1"));
    expect(res.status).toBe(400);
    expect(db.sleepLog.update).not.toHaveBeenCalled();
  });

  it("returns 400 when new startTime makes effective end <= start", async () => {
    // existing endTime = 2026-07-02T07:00:00Z
    // send startTime AFTER the existing endTime → end ≤ start
    const res = await PATCH(makeReq({ startTime: "2026-07-02T08:00:00.000Z" }), makeCtx("sl-1"));
    expect(res.status).toBe(400);
    expect(db.sleepLog.update).not.toHaveBeenCalled();
  });

  // 400 — Zod validation failures

  it("returns 400 when quality is out of range (0)", async () => {
    const res = await PATCH(makeReq({ quality: 0 }), makeCtx("sl-1"));
    expect(res.status).toBe(400);
    expect(db.sleepLog.update).not.toHaveBeenCalled();
  });

  it("returns 400 when quality is out of range (6)", async () => {
    const res = await PATCH(makeReq({ quality: SLEEP_QUALITY_MAX + 1 }), makeCtx("sl-1"));
    expect(res.status).toBe(400);
    expect(db.sleepLog.update).not.toHaveBeenCalled();
  });

  it(`returns 400 when note exceeds SLEEP_NOTE_MAX_LEN (${SLEEP_NOTE_MAX_LEN}) characters`, async () => {
    const res = await PATCH(
      makeReq({ note: "N".repeat(SLEEP_NOTE_MAX_LEN + 1) }),
      makeCtx("sl-1"),
    );
    expect(res.status).toBe(400);
    expect(db.sleepLog.update).not.toHaveBeenCalled();
  });

  it("returns error body on 404", async () => {
    db.sleepLog.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq({ endTime: NEW_END }), makeCtx("missing"));
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body.error).toBeTruthy();
  });
});
