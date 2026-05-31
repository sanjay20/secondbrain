import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH, DELETE } from "@/app/api/vision/bucket-list/[id]/route";
import { prisma } from "@/lib/db";

const db = prisma as unknown as {
  bucketListItem: {
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

const existingItem = {
  id: "bli-1",
  userId: "user-1",
  title: "Visit Iceland",
  category: "travel",
  notes: null,
  completedAt: null,
  createdAt: new Date("2026-05-30T00:00:00Z"),
  updatedAt: new Date("2026-05-30T00:00:00Z"),
};

describe("PATCH /api/vision/bucket-list/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.bucketListItem.findFirst.mockResolvedValue(existingItem);
    db.bucketListItem.update.mockResolvedValue({ ...existingItem, title: "Updated Title" });
  });

  it("updates title and verifies ownership via userId", async () => {
    const res = await PATCH(makeReq({ title: "Hike Patagonia" }), makeCtx("bli-1"));
    expect(res.status).toBe(200);
    expect(db.bucketListItem.findFirst).toHaveBeenCalledWith({
      where: { id: "bli-1", userId: "user-1" },
    });
    expect(db.bucketListItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "bli-1" },
        data: expect.objectContaining({ title: "Hike Patagonia" }),
      })
    );
  });

  it("updates category", async () => {
    db.bucketListItem.update.mockResolvedValue({ ...existingItem, category: "achievement" });
    const res = await PATCH(makeReq({ category: "achievement" }), makeCtx("bli-1"));
    expect(res.status).toBe(200);
    expect(db.bucketListItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ category: "achievement" }) })
    );
  });

  it("updates notes", async () => {
    db.bucketListItem.update.mockResolvedValue({ ...existingItem, notes: "Pack light" });
    const res = await PATCH(makeReq({ notes: "Pack light" }), makeCtx("bli-1"));
    expect(res.status).toBe(200);
    const call = db.bucketListItem.update.mock.calls[0][0];
    expect(call.data).toMatchObject({ notes: "Pack light" });
  });

  it("sets completedAt to a Date when completed: true (AC-3)", async () => {
    db.bucketListItem.update.mockResolvedValue({ ...existingItem, completedAt: new Date() });
    const res = await PATCH(makeReq({ completed: true }), makeCtx("bli-1"));
    expect(res.status).toBe(200);
    const call = db.bucketListItem.update.mock.calls[0][0];
    expect(call.data.completedAt).toBeInstanceOf(Date);
  });

  it("clears completedAt to null when completed: false (AC-4)", async () => {
    const doneItem = { ...existingItem, completedAt: new Date() };
    db.bucketListItem.findFirst.mockResolvedValue(doneItem);
    db.bucketListItem.update.mockResolvedValue({ ...doneItem, completedAt: null });
    const res = await PATCH(makeReq({ completed: false }), makeCtx("bli-1"));
    expect(res.status).toBe(200);
    const call = db.bucketListItem.update.mock.calls[0][0];
    expect(call.data.completedAt).toBeNull();
  });

  it("does not set completedAt when completed is not provided", async () => {
    await PATCH(makeReq({ title: "New Title" }), makeCtx("bli-1"));
    const call = db.bucketListItem.update.mock.calls[0][0];
    expect(call.data).not.toHaveProperty("completedAt");
  });

  it("updates multiple fields at once", async () => {
    db.bucketListItem.update.mockResolvedValue({ ...existingItem, title: "New Title", category: "experience" });
    const res = await PATCH(makeReq({ title: "New Title", category: "experience", notes: "Bring sunscreen" }), makeCtx("bli-1"));
    expect(res.status).toBe(200);
    const call = db.bucketListItem.update.mock.calls[0][0];
    expect(call.data).toMatchObject({ title: "New Title", category: "experience", notes: "Bring sunscreen" });
  });

  it("returns 404 when item is not found", async () => {
    db.bucketListItem.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq({ title: "New Title" }), makeCtx("missing-id"));
    expect(res.status).toBe(404);
    expect(db.bucketListItem.update).not.toHaveBeenCalled();
  });

  it("returns 404 when item belongs to a different user (AC-8 / NFR-1)", async () => {
    db.bucketListItem.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq({ title: "New Title" }), makeCtx("bli-other"));
    expect(res.status).toBe(404);
    expect(db.bucketListItem.update).not.toHaveBeenCalled();
  });

  it("returns 400 when category is invalid", async () => {
    const res = await PATCH(makeReq({ category: "hobby" }), makeCtx("bli-1"));
    expect(res.status).toBe(400);
    expect(db.bucketListItem.update).not.toHaveBeenCalled();
  });

  it("returns 400 when title is empty string", async () => {
    const res = await PATCH(makeReq({ title: "" }), makeCtx("bli-1"));
    expect(res.status).toBe(400);
    expect(db.bucketListItem.update).not.toHaveBeenCalled();
  });

  it("returns 400 when title exceeds 200 characters", async () => {
    const res = await PATCH(makeReq({ title: "A".repeat(201) }), makeCtx("bli-1"));
    expect(res.status).toBe(400);
    expect(db.bucketListItem.update).not.toHaveBeenCalled();
  });

  it("returns 400 when notes exceed 2000 characters", async () => {
    const res = await PATCH(makeReq({ notes: "A".repeat(2001) }), makeCtx("bli-1"));
    expect(res.status).toBe(400);
    expect(db.bucketListItem.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/vision/bucket-list/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.bucketListItem.findFirst.mockResolvedValue(existingItem);
    db.bucketListItem.delete.mockResolvedValue({});
  });

  it("deletes item scoped to userId (AC-6)", async () => {
    const res = await DELETE({} as Request, makeCtx("bli-1"));
    expect(res.status).toBe(200);
    expect(db.bucketListItem.findFirst).toHaveBeenCalledWith({
      where: { id: "bli-1", userId: "user-1" },
    });
    expect(db.bucketListItem.delete).toHaveBeenCalledWith({ where: { id: "bli-1" } });
  });

  it("returns success: true on successful delete", async () => {
    const res = await DELETE({} as Request, makeCtx("bli-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  it("returns 404 when item is not found", async () => {
    db.bucketListItem.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("missing-id"));
    expect(res.status).toBe(404);
    expect(db.bucketListItem.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when item belongs to a different user (AC-8)", async () => {
    db.bucketListItem.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("bli-other"));
    expect(res.status).toBe(404);
    expect(db.bucketListItem.delete).not.toHaveBeenCalled();
  });
});
