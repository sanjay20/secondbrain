import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/books/[id]/task/route";
import { prisma } from "@/lib/db";

const db = prisma as unknown as {
  readingItem: { findFirst: ReturnType<typeof vi.fn> };
  task: { create: ReturnType<typeof vi.fn> };
  bookLink: { create: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

const makeReq = (body: unknown) =>
  ({ json: async () => body, url: "http://localhost/api/books/bk-1/task" } as unknown as Request);

const params = (id: string) => ({ params: Promise.resolve({ id }) });

const book = { id: "bk-1", userId: "user-1", title: "Deep Work" };
const task = { id: "t-1", userId: "user-1", title: "Read: Deep Work" };

describe("POST /api/books/[id]/task", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.readingItem.findFirst.mockResolvedValue(book);
    db.task.create.mockResolvedValue(task);
    db.bookLink.create.mockResolvedValue({ id: "bl-1" });
    // interactive transaction: invoke the callback with the same mocked client
    db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db));
  });

  it("404s on a book the user does not own", async () => {
    db.readingItem.findFirst.mockResolvedValueOnce(null);
    const res = await POST(makeReq({ scheduledDate: "2026-10-10" }), params("bk-1"));
    expect(res.status).toBe(404);
    expect(db.task.create).not.toHaveBeenCalled();
  });

  it("scopes the ownership lookup to the authenticated user", async () => {
    await POST(makeReq({ scheduledDate: "2026-10-10" }), params("bk-1"));
    expect(db.readingItem.findFirst.mock.calls[0][0].where).toEqual({
      id: "bk-1",
      userId: "user-1",
    });
  });

  it("returns 400 when scheduledDate is missing", async () => {
    const res = await POST(makeReq({}), params("bk-1"));
    expect(res.status).toBe(400);
    expect(db.task.create).not.toHaveBeenCalled();
  });

  it("creates the task under the knowledge pillar for the authenticated user", async () => {
    const res = await POST(makeReq({ scheduledDate: "2026-10-10" }), params("bk-1"));
    expect(res.status).toBe(201);
    const data = db.task.create.mock.calls[0][0].data;
    expect(data.userId).toBe("user-1");
    expect(data.pillar).toBe("knowledge");
    expect(data.status).toBe("todo");
    expect(data.priority).toBe("medium");
  });

  it("converts scheduledDate to a Date rather than passing the string through", async () => {
    await POST(makeReq({ scheduledDate: "2026-10-10" }), params("bk-1"));
    expect(db.task.create.mock.calls[0][0].data.scheduledDate).toBeInstanceOf(Date);
  });

  it("defaults the title to Read: <book title>", async () => {
    await POST(makeReq({ scheduledDate: "2026-10-10" }), params("bk-1"));
    expect(db.task.create.mock.calls[0][0].data.title).toBe("Read: Deep Work");
  });

  it("honors a supplied title and priority", async () => {
    await POST(
      makeReq({ scheduledDate: "2026-10-10", title: "Read ch. 3", priority: "high" }),
      params("bk-1")
    );
    const data = db.task.create.mock.calls[0][0].data;
    expect(data.title).toBe("Read ch. 3");
    expect(data.priority).toBe("high");
  });

  it("links the new task back to the book with only taskId set", async () => {
    await POST(makeReq({ scheduledDate: "2026-10-10" }), params("bk-1"));
    const data = db.bookLink.create.mock.calls[0][0].data;
    expect(data).toEqual({ userId: "user-1", readingItemId: "bk-1", taskId: "t-1" });
    expect(data).not.toHaveProperty("goalId");
    expect(data).not.toHaveProperty("habitId");
    expect(data).not.toHaveProperty("skillId");
  });

  it("creates the task and its link in one transaction", async () => {
    await POST(makeReq({ scheduledDate: "2026-10-10" }), params("bk-1"));
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
});
