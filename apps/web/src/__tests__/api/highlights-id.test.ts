import { describe, it, expect, vi, beforeEach } from "vitest";
import { DELETE } from "@/app/api/highlights/[id]/route";
import { prisma } from "@/lib/db";

const db = prisma as unknown as {
  highlight: {
    findFirst: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

const makeReq = () => ({} as unknown as Request);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

const sampleHighlight = { id: "hl-1", userId: "user-1", readingItemId: "ri-1", text: "…", createdAt: new Date() };

describe("DELETE /api/highlights/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.highlight.findFirst.mockResolvedValue(sampleHighlight);
    db.highlight.delete.mockResolvedValue(sampleHighlight);
  });

  it("looks up the highlight scoped to id AND userId (ownership gate)", async () => {
    await DELETE(makeReq(), ctx("hl-1"));
    const call = db.highlight.findFirst.mock.calls[0][0];
    expect(call.where).toEqual({ id: "hl-1", userId: "user-1" });
  });

  it("deletes and returns success for the owner", async () => {
    const res = await DELETE(makeReq(), ctx("hl-1"));
    expect(res.status).toBe(200);
    expect(db.highlight.delete).toHaveBeenCalledWith({ where: { id: "hl-1" } });
  });

  it("returns 404 and does not delete when not owned (AC-5)", async () => {
    db.highlight.findFirst.mockResolvedValue(null);
    const res = await DELETE(makeReq(), ctx("hl-1"));
    expect(res.status).toBe(404);
    expect(db.highlight.delete).not.toHaveBeenCalled();
  });
});
