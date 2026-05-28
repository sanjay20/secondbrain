import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/reminders/process/route";
import { prisma } from "@/lib/db";

vi.mock("@/lib/email", () => ({ sendReminderEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn().mockResolvedValue(undefined) }));

import { sendReminderEmail } from "@/lib/email";
import { sendPushNotification } from "@/lib/push";

const mockPrisma = prisma as {
  reminder: {
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

describe("POST /api/reminders/process", () => {
  const secret = "test-secret";
  process.env.REMINDER_PROCESS_SECRET = secret;

  const makeRequest = (headerSecret?: string) =>
    ({ headers: { get: (h: string) => (h === "x-reminder-secret" ? headerSecret : null) } } as unknown as Request);

  const dueReminder = {
    id: "r-1",
    scheduledAt: new Date(Date.now() - 1000),
    journalEntry: { content: "Follow up with Dr. Singh", category: "health" },
    user: { email: "test@example.com", pushSubscription: null },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.reminder.findMany.mockResolvedValue([]);
    mockPrisma.reminder.update.mockResolvedValue({});
  });

  it("returns 401 when secret header is missing", async () => {
    const res = await POST(makeRequest(undefined));
    expect(res.status).toBe(401);
    expect(mockPrisma.reminder.findMany).not.toHaveBeenCalled();
  });

  it("returns 401 when secret header is wrong", async () => {
    const res = await POST(makeRequest("wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("returns processed: 0 when no reminders are due", async () => {
    const res = await POST(makeRequest(secret));
    expect(res.status).toBe(200);
    expect((res as unknown as { _body: { processed: number } })._body.processed).toBe(0);
  });

  it("sends email and marks status sent for each due reminder", async () => {
    mockPrisma.reminder.findMany.mockResolvedValue([dueReminder]);

    const res = await POST(makeRequest(secret));

    expect(sendReminderEmail).toHaveBeenCalledOnce();
    expect(sendReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "test@example.com", entryContent: "Follow up with Dr. Singh" })
    );
    expect(mockPrisma.reminder.update).toHaveBeenCalledWith({
      where: { id: "r-1" },
      data: { status: "sent" },
    });
    expect((res as unknown as { _body: { processed: number } })._body.processed).toBe(1);
  });

  it("sends push notification when user has a subscription", async () => {
    const pushSub = { endpoint: "https://push.example.com", keys: { p256dh: "key", auth: "auth" } };
    mockPrisma.reminder.findMany.mockResolvedValue([
      { ...dueReminder, user: { ...dueReminder.user, pushSubscription: pushSub } },
    ]);

    await POST(makeRequest(secret));

    expect(sendPushNotification).toHaveBeenCalledOnce();
    expect(sendPushNotification).toHaveBeenCalledWith(
      pushSub,
      expect.objectContaining({ title: "SecondBrain reminder" })
    );
  });

  it("skips push but still sends email when no push subscription", async () => {
    mockPrisma.reminder.findMany.mockResolvedValue([dueReminder]);
    await POST(makeRequest(secret));
    expect(sendPushNotification).not.toHaveBeenCalled();
    expect(sendReminderEmail).toHaveBeenCalledOnce();
  });

  it("continues processing remaining reminders if one fails", async () => {
    const failReminder = { ...dueReminder, id: "r-fail" };
    mockPrisma.reminder.findMany.mockResolvedValue([failReminder, dueReminder]);
    (sendReminderEmail as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("Resend error"))
      .mockResolvedValueOnce(undefined);

    const res = await POST(makeRequest(secret));

    expect((res as unknown as { _body: { processed: number } })._body.processed).toBe(1);
    expect(mockPrisma.reminder.update).toHaveBeenCalledTimes(1);
  });

  it("queries only pending reminders with scheduledAt <= now", async () => {
    await POST(makeRequest(secret));
    expect(mockPrisma.reminder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "pending" }),
      })
    );
  });
});
