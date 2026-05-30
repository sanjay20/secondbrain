import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH, DELETE } from "@/app/api/vision/[id]/route";
import { prisma } from "@/lib/db";

const db = prisma as unknown as {
  visionArea: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

const makeReq = (body: unknown) =>
  ({ json: async () => body } as unknown as Request);
const makeCtx = (id: string) =>
  ({ params: Promise.resolve({ id }) } as { params: Promise<{ id: string }> });

const existingArea = {
  id: "va-1",
  userId: "user-1",
  name: "Health & Fitness",
  statement: "I will maintain a strong, healthy body through daily exercise and mindful nutrition.",
  emoji: "💪",
  color: "#10b981",
  createdAt: new Date("2026-05-30T00:00:00Z"),
  updatedAt: new Date("2026-05-30T00:00:00Z"),
};

describe("PATCH /api/vision/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.visionArea.findFirst.mockResolvedValue(existingArea);
    db.visionArea.update.mockResolvedValue({ ...existingArea, name: "Updated Name" });
  });

  it("updates name and verifies ownership via userId", async () => {
    const res = await PATCH(makeReq({ name: "Mind & Body" }), makeCtx("va-1"));
    expect(res.status).toBe(200);
    expect(db.visionArea.findFirst).toHaveBeenCalledWith({
      where: { id: "va-1", userId: "user-1" },
    });
    expect(db.visionArea.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "va-1" },
        data: expect.objectContaining({ name: "Mind & Body" }),
      })
    );
  });

  it("updates statement", async () => {
    const newStatement = "I will achieve optimal health through consistent habits.";
    db.visionArea.update.mockResolvedValue({ ...existingArea, statement: newStatement });
    const res = await PATCH(makeReq({ statement: newStatement }), makeCtx("va-1"));
    expect(res.status).toBe(200);
    expect(db.visionArea.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ statement: newStatement }) })
    );
  });

  it("updates emoji and color", async () => {
    db.visionArea.update.mockResolvedValue({ ...existingArea, emoji: "🏃", color: "#3b82f6" });
    const res = await PATCH(makeReq({ emoji: "🏃", color: "#3b82f6" }), makeCtx("va-1"));
    expect(res.status).toBe(200);
    const call = db.visionArea.update.mock.calls[0][0];
    expect(call.data).toMatchObject({ emoji: "🏃", color: "#3b82f6" });
  });

  it("updates multiple fields at once", async () => {
    db.visionArea.update.mockResolvedValue({ ...existingArea, name: "New Name", emoji: "🎯" });
    const res = await PATCH(makeReq({ name: "New Name", emoji: "🎯", color: "#ef4444" }), makeCtx("va-1"));
    expect(res.status).toBe(200);
    const call = db.visionArea.update.mock.calls[0][0];
    expect(call.data).toMatchObject({ name: "New Name", emoji: "🎯", color: "#ef4444" });
  });

  it("returns 404 when vision area is not found", async () => {
    db.visionArea.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq({ name: "New Name" }), makeCtx("missing-id"));
    expect(res.status).toBe(404);
    expect(db.visionArea.update).not.toHaveBeenCalled();
  });

  it("returns 404 when area belongs to a different user", async () => {
    db.visionArea.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq({ name: "New Name" }), makeCtx("va-other"));
    expect(res.status).toBe(404);
    expect(db.visionArea.update).not.toHaveBeenCalled();
  });

  it("returns 400 when name is empty string", async () => {
    const res = await PATCH(makeReq({ name: "" }), makeCtx("va-1"));
    expect(res.status).toBe(400);
    expect(db.visionArea.update).not.toHaveBeenCalled();
  });

  it("returns 400 when statement is empty string", async () => {
    const res = await PATCH(makeReq({ statement: "" }), makeCtx("va-1"));
    expect(res.status).toBe(400);
    expect(db.visionArea.update).not.toHaveBeenCalled();
  });

  it("returns 400 when name exceeds 80 characters", async () => {
    const res = await PATCH(makeReq({ name: "A".repeat(81) }), makeCtx("va-1"));
    expect(res.status).toBe(400);
    expect(db.visionArea.update).not.toHaveBeenCalled();
  });

  it("returns 400 when statement exceeds 2000 characters", async () => {
    const res = await PATCH(makeReq({ statement: "A".repeat(2001) }), makeCtx("va-1"));
    expect(res.status).toBe(400);
    expect(db.visionArea.update).not.toHaveBeenCalled();
  });

  it("allows patching with only optional fields (emoji)", async () => {
    db.visionArea.update.mockResolvedValue({ ...existingArea, emoji: "🌟" });
    const res = await PATCH(makeReq({ emoji: "🌟" }), makeCtx("va-1"));
    expect(res.status).toBe(200);
    expect(db.visionArea.update).toHaveBeenCalled();
  });
});

describe("DELETE /api/vision/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.visionArea.findFirst.mockResolvedValue(existingArea);
    db.visionArea.delete.mockResolvedValue({});
  });

  it("deletes vision area scoped to userId", async () => {
    const res = await DELETE({} as Request, makeCtx("va-1"));
    expect(res.status).toBe(200);
    expect(db.visionArea.findFirst).toHaveBeenCalledWith({
      where: { id: "va-1", userId: "user-1" },
    });
    expect(db.visionArea.delete).toHaveBeenCalledWith({ where: { id: "va-1" } });
  });

  it("returns success: true on successful delete", async () => {
    const res = await DELETE({} as Request, makeCtx("va-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  it("returns 404 when vision area is not found", async () => {
    db.visionArea.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("missing-id"));
    expect(res.status).toBe(404);
    expect(db.visionArea.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when area belongs to a different user", async () => {
    db.visionArea.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("va-other"));
    expect(res.status).toBe(404);
    expect(db.visionArea.delete).not.toHaveBeenCalled();
  });
});
