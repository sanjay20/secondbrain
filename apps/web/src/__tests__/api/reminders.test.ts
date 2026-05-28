import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/reminders/route";
import { DELETE } from "@/app/api/reminders/[id]/route";
import { prisma } from "@/lib/db";

const mockPrisma = prisma as {
  journalEntry: { findFirst: ReturnType<typeof vi.fn> };
  reminder: {
    upsert: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

// ─── POST /api/reminders ─────────────────────────────────────────────────────

describe("POST /api/reminders", () => {
  const makeRequest = (body: unknown) =>
    ({ json: async () => body, headers: { get: () => null } } as unknown as Request);

  const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.journalEntry.findFirst.mockResolvedValue({ id: "entry-1", userId: "user-1" });
    mockPrisma.reminder.upsert.mockResolvedValue({
      id: "reminder-1",
      journalEntryId: "entry-1",
      userId: "user-1",
      scheduledAt: new Date(futureDate),
      status: "pending",
    });
  });

  it("creates a reminder for a valid future datetime", async () => {
    const res = await POST(makeRequest({ journalEntryId: "entry-1", scheduledAt: futureDate }));
    expect(res.status).toBe(201);
    expect(mockPrisma.reminder.upsert).toHaveBeenCalledOnce();
    const call = mockPrisma.reminder.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ journalEntryId: "entry-1" });
    expect(call.create.status).toBe("pending");
  });

  it("upserts when a reminder already exists for the entry", async () => {
    const laterDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    await POST(makeRequest({ journalEntryId: "entry-1", scheduledAt: futureDate }));
    await POST(makeRequest({ journalEntryId: "entry-1", scheduledAt: laterDate }));
    expect(mockPrisma.reminder.upsert).toHaveBeenCalledTimes(2);
  });

  it("returns 400 for a past datetime", async () => {
    const pastDate = new Date(Date.now() - 60_000).toISOString();
    const res = await POST(makeRequest({ journalEntryId: "entry-1", scheduledAt: pastDate }));
    expect(res.status).toBe(400);
    expect(mockPrisma.reminder.upsert).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-ISO datetime string", async () => {
    const res = await POST(makeRequest({ journalEntryId: "entry-1", scheduledAt: "not-a-date" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the journal entry does not belong to the user", async () => {
    mockPrisma.journalEntry.findFirst.mockResolvedValue(null);
    const res = await POST(makeRequest({ journalEntryId: "other-entry", scheduledAt: futureDate }));
    expect(res.status).toBe(404);
    expect(mockPrisma.reminder.upsert).not.toHaveBeenCalled();
  });

  it("returns 400 when journalEntryId is missing", async () => {
    const res = await POST(makeRequest({ scheduledAt: futureDate }));
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /api/reminders/[id] ──────────────────────────────────────────────

describe("DELETE /api/reminders/[id]", () => {
  const makeCtx = (id: string) =>
    ({ params: Promise.resolve({ id }) } as { params: Promise<{ id: string }> });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.reminder.findFirst.mockResolvedValue({ id: "reminder-1", userId: "user-1" });
    mockPrisma.reminder.delete.mockResolvedValue({});
  });

  it("deletes the reminder and returns success", async () => {
    const res = await DELETE({} as Request, makeCtx("reminder-1"));
    expect(res.status).toBe(200);
    expect(mockPrisma.reminder.delete).toHaveBeenCalledWith({ where: { id: "reminder-1" } });
  });

  it("returns 404 when reminder is not found", async () => {
    mockPrisma.reminder.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("nonexistent"));
    expect(res.status).toBe(404);
    expect(mockPrisma.reminder.delete).not.toHaveBeenCalled();
  });

  it("scopes lookup to the authenticated user", async () => {
    await DELETE({} as Request, makeCtx("reminder-1"));
    expect(mockPrisma.reminder.findFirst).toHaveBeenCalledWith({
      where: { id: "reminder-1", userId: "user-1" },
    });
  });
});
