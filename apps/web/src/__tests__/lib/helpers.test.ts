import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── lib/email.ts ─────────────────────────────────────────────────────────────

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn().mockResolvedValue({ id: "email-1" }),
}));
vi.mock("resend", () => {
  function Resend() { return { emails: { send: mockSend } }; }
  return { Resend };
});

import { sendReminderEmail } from "@/lib/email";

describe("sendReminderEmail", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const opts = {
    to: "user@example.com",
    entryContent: "Follow up with Dr. Singh about test results",
    category: "health",
    scheduledAt: new Date("2026-06-01T09:00:00Z"),
  };

  it("calls Resend with correct to/subject fields", async () => {
    await sendReminderEmail(opts);
    expect(mockSend).toHaveBeenCalledOnce();
    const call = mockSend.mock.calls[0][0];
    expect(call.to).toBe("user@example.com");
    expect(call.subject).toMatch(/reminder/i);
  });

  it("includes entry content and category in the html body", async () => {
    await sendReminderEmail(opts);
    const { html } = mockSend.mock.calls[0][0] as { html: string };
    expect(html).toContain("Follow up with Dr. Singh");
    expect(html).toContain("health");
  });

  it("includes a link to /journal in the html body", async () => {
    await sendReminderEmail(opts);
    const { html } = mockSend.mock.calls[0][0] as { html: string };
    expect(html).toContain("/journal");
  });

  it("propagates errors thrown by Resend", async () => {
    mockSend.mockRejectedValueOnce(new Error("API error"));
    await expect(sendReminderEmail(opts)).rejects.toThrow("API error");
  });
});

// ─── lib/push.ts ──────────────────────────────────────────────────────────────

const { mockSendNotification } = vi.hoisted(() => ({
  mockSendNotification: vi.fn().mockResolvedValue({}),
}));
vi.mock("web-push", () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: mockSendNotification },
}));

import { sendPushNotification } from "@/lib/push";

describe("sendPushNotification", () => {
  process.env.VAPID_EMAIL = "mailto:test@example.com";
  process.env.VAPID_PUBLIC_KEY = "fake-public-key";
  process.env.VAPID_PRIVATE_KEY = "fake-private-key";

  beforeEach(() => { vi.clearAllMocks(); });

  const subscription = {
    endpoint: "https://fcm.googleapis.com/push/abc123",
    keys: { p256dh: "key-abc", auth: "auth-abc" },
  } as Parameters<typeof sendPushNotification>[0];

  const payload = { title: "SecondBrain reminder", body: "Follow up", url: "/journal" };

  it("calls webpush.sendNotification with the subscription", async () => {
    await sendPushNotification(subscription, payload);
    expect(mockSendNotification).toHaveBeenCalledOnce();
    expect(mockSendNotification.mock.calls[0][0]).toBe(subscription);
  });

  it("serialises the payload as JSON string", async () => {
    await sendPushNotification(subscription, payload);
    const sent = JSON.parse(mockSendNotification.mock.calls[0][1] as string) as typeof payload;
    expect(sent.title).toBe("SecondBrain reminder");
    expect(sent.url).toBe("/journal");
  });

  it("propagates errors thrown by webpush", async () => {
    mockSendNotification.mockRejectedValueOnce(new Error("Push error"));
    await expect(sendPushNotification(subscription, payload)).rejects.toThrow("Push error");
  });
});
