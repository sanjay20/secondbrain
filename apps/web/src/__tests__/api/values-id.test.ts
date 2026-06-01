import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH, DELETE } from "@/app/api/vision/values/[id]/route";
import { prisma } from "@/lib/db";

const db = prisma as unknown as {
  coreValue: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

const makeReq = (body: unknown) =>
  ({ json: async () => body } as unknown as Request);
const makeCtx = (id: string) =>
  ({ params: Promise.resolve({ id }) } as { params: Promise<{ id: string }> });

const existingValue = {
  id: "cv-1",
  userId: "user-1",
  name: "Family",
  description: "My family comes first.",
  createdAt: new Date("2026-05-31T00:00:00Z"),
  updatedAt: new Date("2026-05-31T00:00:00Z"),
};

describe("PATCH /api/vision/values/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.coreValue.findFirst.mockResolvedValue(existingValue);
    db.coreValue.update.mockResolvedValue({ ...existingValue, name: "Updated Name" });
  });

  it("updates name and verifies ownership via userId (AC-7 scoping)", async () => {
    const res = await PATCH(makeReq({ name: "Integrity" }), makeCtx("cv-1"));
    expect(res.status).toBe(200);
    expect(db.coreValue.findFirst).toHaveBeenCalledWith({
      where: { id: "cv-1", userId: "user-1" },
    });
    expect(db.coreValue.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cv-1" },
        data: expect.objectContaining({ name: "Integrity" }),
      })
    );
  });

  it("updates description", async () => {
    db.coreValue.update.mockResolvedValue({ ...existingValue, description: "New description." });
    const res = await PATCH(makeReq({ description: "New description." }), makeCtx("cv-1"));
    expect(res.status).toBe(200);
    const call = db.coreValue.update.mock.calls[0][0];
    expect(call.data).toMatchObject({ description: "New description." });
  });

  it("updates both name and description at once", async () => {
    db.coreValue.update.mockResolvedValue({ ...existingValue, name: "Growth", description: "Always learning." });
    const res = await PATCH(makeReq({ name: "Growth", description: "Always learning." }), makeCtx("cv-1"));
    expect(res.status).toBe(200);
    const call = db.coreValue.update.mock.calls[0][0];
    expect(call.data).toMatchObject({ name: "Growth", description: "Always learning." });
  });

  it("returns 404 when item is not found", async () => {
    db.coreValue.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq({ name: "Courage" }), makeCtx("missing-id"));
    expect(res.status).toBe(404);
    expect(db.coreValue.update).not.toHaveBeenCalled();
  });

  it("returns 404 when item belongs to a different user (AC-7 scoping)", async () => {
    db.coreValue.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq({ name: "Courage" }), makeCtx("cv-other"));
    expect(res.status).toBe(404);
    expect(db.coreValue.update).not.toHaveBeenCalled();
  });

  it("returns 400 when name is empty string", async () => {
    const res = await PATCH(makeReq({ name: "" }), makeCtx("cv-1"));
    expect(res.status).toBe(400);
    expect(db.coreValue.update).not.toHaveBeenCalled();
  });

  it("returns 400 when name exceeds 50 characters", async () => {
    const res = await PATCH(makeReq({ name: "A".repeat(51) }), makeCtx("cv-1"));
    expect(res.status).toBe(400);
    expect(db.coreValue.update).not.toHaveBeenCalled();
  });

  it("returns 400 when description exceeds 300 characters", async () => {
    const res = await PATCH(makeReq({ description: "A".repeat(301) }), makeCtx("cv-1"));
    expect(res.status).toBe(400);
    expect(db.coreValue.update).not.toHaveBeenCalled();
  });

  it("accepts name at exactly 50 characters", async () => {
    db.coreValue.update.mockResolvedValue({ ...existingValue, name: "A".repeat(50) });
    const res = await PATCH(makeReq({ name: "A".repeat(50) }), makeCtx("cv-1"));
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/vision/values/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.coreValue.findFirst.mockResolvedValue(existingValue);
    db.coreValue.delete.mockResolvedValue({});
  });

  it("deletes value scoped to userId", async () => {
    const res = await DELETE({} as Request, makeCtx("cv-1"));
    expect(res.status).toBe(200);
    expect(db.coreValue.findFirst).toHaveBeenCalledWith({
      where: { id: "cv-1", userId: "user-1" },
    });
    expect(db.coreValue.delete).toHaveBeenCalledWith({ where: { id: "cv-1" } });
  });

  it("returns success: true on successful delete", async () => {
    const res = await DELETE({} as Request, makeCtx("cv-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  it("returns 404 when item is not found", async () => {
    db.coreValue.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("missing-id"));
    expect(res.status).toBe(404);
    expect(db.coreValue.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when item belongs to a different user (AC-7 scoping)", async () => {
    db.coreValue.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("cv-other"));
    expect(res.status).toBe(404);
    expect(db.coreValue.delete).not.toHaveBeenCalled();
  });
});
