import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/savings/route";
import { prisma } from "@/lib/db";
import { EARN_RULES, dbDateKey } from "@/lib/life-savings";
import { SAVINGS_WINDOW_DAYS, SAVINGS_MIN_WINDOW_DAYS, SAVINGS_MAX_WINDOW_DAYS } from "@secondbrain/types";
import type { SavingsBalance } from "@secondbrain/types";

const db = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

const makeReq = (url: string) => ({ url } as unknown as Request);

/** Local midnight today — how the app writes date-only columns. */
function todayLocal(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

beforeEach(() => {
  vi.clearAllMocks();
  db.habit.count.mockResolvedValue(0);
  db.habitLog.findMany.mockResolvedValue([]);
  db.task.findMany.mockResolvedValue([]);
  db.workout.findMany.mockResolvedValue([]);
  db.sleepLog.findMany.mockResolvedValue([]);
  db.moodLog.findMany.mockResolvedValue([]);
  db.journalEntry.findMany.mockResolvedValue([]);
  db.gratitudeEntry.findMany.mockResolvedValue([]);
  db.milestone.findMany.mockResolvedValue([]);
  db.savingsLeakLog.findMany.mockResolvedValue([]);
});

describe("GET /api/savings", () => {
  it("returns a zero ledger for a user with no data", async () => {
    const res = await GET(makeReq("http://localhost/api/savings"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as SavingsBalance;
    expect(body.balance).toBe(0);
    expect(body.windowDays).toBe(SAVINGS_WINDOW_DAYS);
    expect(body.days).toHaveLength(SAVINGS_WINDOW_DAYS);
  });

  it("scopes every underlying query to the authenticated user", async () => {
    await GET(makeReq("http://localhost/api/savings"));
    expect(db.habitLog.findMany.mock.calls[0][0].where).toMatchObject({ userId: "user-1" });
    expect(db.savingsLeakLog.findMany.mock.calls[0][0].where).toMatchObject({ userId: "user-1" });
    // Milestones hang off a goal, so ownership is enforced through the relation.
    expect(db.milestone.findMany.mock.calls[0][0].where.goal).toMatchObject({ userId: "user-1" });
  });

  it("only counts completed habit logs", async () => {
    await GET(makeReq("http://localhost/api/savings"));
    expect(db.habitLog.findMany.mock.calls[0][0].where).toMatchObject({ completed: true });
  });

  it("turns a completed habit into credits", async () => {
    db.habit.count.mockResolvedValue(3);
    db.habitLog.findMany.mockResolvedValue([
      { date: todayLocal(), habit: { category: "fitness" } },
    ]);
    const res = await GET(makeReq("http://localhost/api/savings"));
    const body = (await res.json()) as SavingsBalance;
    expect(body.balance).toBe(EARN_RULES.habitDone.credits);
    expect(body.pillars.find((p) => p.pillar === "health")?.earned).toBe(
      EARN_RULES.habitDone.credits
    );
  });

  it("subtracts a logged leak, multiplied by its intensity", async () => {
    db.savingsLeakLog.findMany.mockResolvedValue([
      {
        leakId: "leak-1",
        date: todayLocal(),
        cost: 20,
        intensity: 2,
        leak: { name: "Slept late", icon: "🌙", category: "energy", pillar: "health" },
      },
    ]);
    const res = await GET(makeReq("http://localhost/api/savings"));
    const body = (await res.json()) as SavingsBalance;
    expect(body.spent).toBe(40);
    expect(body.balance).toBe(-40);
    expect(body.leakBreakdown[0]).toMatchObject({ name: "Slept late", credits: 40, count: 1 });
  });

  it("credits a full night's sleep to the day the user woke up", async () => {
    const today = todayLocal();
    const wake = new Date(today.getTime() + 7 * 60 * 60 * 1000); // 07:00 today
    const bed = new Date(wake.getTime() - 8 * 60 * 60 * 1000); // 23:00 yesterday
    db.sleepLog.findMany.mockResolvedValue([{ startTime: bed, endTime: wake }]);

    const res = await GET(makeReq("http://localhost/api/savings"));
    const body = (await res.json()) as SavingsBalance;
    const todayRow = body.days[body.days.length - 1];
    expect(todayRow.key).toBe(dbDateKey(today));
    expect(todayRow.earned).toBe(EARN_RULES.sleepFull.credits);
  });

  it("does not credit a short night", async () => {
    const today = todayLocal();
    const wake = new Date(today.getTime() + 6 * 60 * 60 * 1000);
    const bed = new Date(wake.getTime() - 5 * 60 * 60 * 1000);
    db.sleepLog.findMany.mockResolvedValue([{ startTime: bed, endTime: wake }]);

    const res = await GET(makeReq("http://localhost/api/savings"));
    const body = (await res.json()) as SavingsBalance;
    expect(body.earned).toBe(0);
  });

  it("raises a red alert when leaks outrun earnings this week", async () => {
    db.habit.count.mockResolvedValue(1);
    db.habitLog.findMany.mockResolvedValue([
      { date: todayLocal(), habit: { category: "general" } },
    ]);
    db.savingsLeakLog.findMany.mockResolvedValue([
      {
        leakId: "leak-1",
        date: todayLocal(),
        cost: 100,
        intensity: 1,
        leak: { name: "Urge relapse", icon: "⛓️", category: "urge", pillar: "personal" },
      },
    ]);
    const res = await GET(makeReq("http://localhost/api/savings"));
    const body = (await res.json()) as SavingsBalance;
    expect(body.alert.level).toBe("critical");
    expect(body.alert.detail).toContain("Urge relapse");
  });

  it("honours a custom window", async () => {
    const res = await GET(makeReq("http://localhost/api/savings?days=30"));
    const body = (await res.json()) as SavingsBalance;
    expect(body.windowDays).toBe(30);
    expect(body.days).toHaveLength(30);
  });

  it("clamps an absurdly small window up to the minimum", async () => {
    const res = await GET(makeReq("http://localhost/api/savings?days=1"));
    const body = (await res.json()) as SavingsBalance;
    expect(body.windowDays).toBe(SAVINGS_MIN_WINDOW_DAYS);
  });

  it("clamps an absurdly large window down to the maximum", async () => {
    const res = await GET(makeReq("http://localhost/api/savings?days=100000"));
    const body = (await res.json()) as SavingsBalance;
    expect(body.windowDays).toBe(SAVINGS_MAX_WINDOW_DAYS);
  });

  it("falls back to the default window for a non-numeric days param", async () => {
    const res = await GET(makeReq("http://localhost/api/savings?days=lots"));
    const body = (await res.json()) as SavingsBalance;
    expect(body.windowDays).toBe(SAVINGS_WINDOW_DAYS);
  });

  it("survives a leak log whose catalog entry has been deleted", async () => {
    db.savingsLeakLog.findMany.mockResolvedValue([
      { leakId: "gone", date: todayLocal(), cost: 10, intensity: 1, leak: null },
    ]);
    const res = await GET(makeReq("http://localhost/api/savings"));
    const body = (await res.json()) as SavingsBalance;
    expect(body.spent).toBe(10);
    expect(body.leakBreakdown[0].name).toBe("Deleted leak");
  });
});
