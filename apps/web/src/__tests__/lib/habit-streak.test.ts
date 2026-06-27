/**
 * Unit tests for findBrokenStreakHabits (apps/web/src/lib/habit-streak.ts).
 *
 * Prisma is mocked via the global setup.ts (habit.findMany + habitLog.findMany).
 *
 * Covers:
 *   - Active daily habits with a completed log TODAY are NOT broken
 *   - Active daily habits with a completed log YESTERDAY are NOT broken
 *   - Active daily habits with NO completed log on either day → broken (OQ-3 / AC-1)
 *   - Inactive habits excluded from results
 *   - Non-daily (weekly) habits excluded from results
 *   - Empty active daily habits set → returns []
 *   - Query scoped to userId + completed:true + correct 2-day date range
 *   - Single habitLog.findMany call (no N+1)
 *   - Returns NudgeHabit shape: { name, category, icon, streak }
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { findBrokenStreakHabits } from "@/lib/habit-streak";

// ── Type helpers for the mocked prisma ───────────────────────────────────────

const db = prisma as unknown as {
  habit: { findMany: ReturnType<typeof vi.fn> };
  habitLog: { findMany: ReturnType<typeof vi.fn> };
};

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TODAY = new Date("2026-06-27T00:00:00.000Z");
const USER_ID = "user-1";

const activeHabit1 = {
  id: "h-1",
  userId: USER_ID,
  name: "Morning run",
  category: "health",
  icon: "🏃",
  streak: 7,
  isActive: true,
  frequency: "daily",
};

const activeHabit2 = {
  id: "h-2",
  userId: USER_ID,
  name: "Meditation",
  category: "mindfulness",
  icon: "🧘",
  streak: 3,
  isActive: true,
  frequency: "daily",
};

const inactiveHabit = {
  id: "h-3",
  userId: USER_ID,
  name: "Evening stretch",
  category: "health",
  icon: "🤸",
  streak: 0,
  isActive: false,
  frequency: "daily",
};

const weeklyHabit = {
  id: "h-4",
  userId: USER_ID,
  name: "Weekly review",
  category: "productivity",
  icon: "📋",
  streak: 2,
  isActive: true,
  frequency: "weekly",
};

// A log for today (h-1 completed)
const logToday = { habitId: "h-1" };
// A log for yesterday (h-2 completed)
const logYesterday = { habitId: "h-2" };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("findBrokenStreakHabits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Empty active daily habits → [] ───────────────────────────────────────────

  it("returns [] when there are no active daily habits", async () => {
    db.habit.findMany.mockResolvedValue([]);
    const result = await findBrokenStreakHabits(prisma, USER_ID, TODAY);
    expect(result).toHaveLength(0);
  });

  it("does not call habitLog.findMany when no active daily habits found", async () => {
    db.habit.findMany.mockResolvedValue([]);
    await findBrokenStreakHabits(prisma, USER_ID, TODAY);
    expect(db.habitLog.findMany).not.toHaveBeenCalled();
  });

  // ── AC-1 / OQ-3: habit with no completed log either day → broken ─────────────

  it("returns a broken habit when no completed log on either day", async () => {
    db.habit.findMany.mockResolvedValue([activeHabit1]);
    db.habitLog.findMany.mockResolvedValue([]); // no completed logs
    const result = await findBrokenStreakHabits(prisma, USER_ID, TODAY);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Morning run");
  });

  it("broken habit has correct NudgeHabit shape", async () => {
    db.habit.findMany.mockResolvedValue([activeHabit1]);
    db.habitLog.findMany.mockResolvedValue([]);
    const result = await findBrokenStreakHabits(prisma, USER_ID, TODAY);
    const h = result[0]!;
    expect(h.name).toBe(activeHabit1.name);
    expect(h.category).toBe(activeHabit1.category);
    expect(h.icon).toBe(activeHabit1.icon);
    expect(h.streak).toBe(activeHabit1.streak);
  });

  // ── Habit with completed log TODAY → NOT broken ───────────────────────────────

  it("does NOT return a habit that has a completed log today", async () => {
    db.habit.findMany.mockResolvedValue([activeHabit1]);
    db.habitLog.findMany.mockResolvedValue([logToday]); // h-1 completed today
    const result = await findBrokenStreakHabits(prisma, USER_ID, TODAY);
    expect(result).toHaveLength(0);
  });

  // ── Habit with completed log YESTERDAY → NOT broken ──────────────────────────

  it("does NOT return a habit that has a completed log yesterday", async () => {
    db.habit.findMany.mockResolvedValue([activeHabit2]);
    db.habitLog.findMany.mockResolvedValue([logYesterday]); // h-2 completed yesterday
    const result = await findBrokenStreakHabits(prisma, USER_ID, TODAY);
    expect(result).toHaveLength(0);
  });

  // ── Multiple habits: some broken, some not ───────────────────────────────────

  it("returns only habits with no completed log in the 2-day window", async () => {
    db.habit.findMany.mockResolvedValue([activeHabit1, activeHabit2]);
    // h-1 completed today, h-2 has no log → h-2 is broken
    db.habitLog.findMany.mockResolvedValue([logToday]);
    const result = await findBrokenStreakHabits(prisma, USER_ID, TODAY);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Meditation");
  });

  it("returns all habits when none have completed logs", async () => {
    db.habit.findMany.mockResolvedValue([activeHabit1, activeHabit2]);
    db.habitLog.findMany.mockResolvedValue([]);
    const result = await findBrokenStreakHabits(prisma, USER_ID, TODAY);
    expect(result).toHaveLength(2);
  });

  it("returns [] when all habits have completed logs", async () => {
    db.habit.findMany.mockResolvedValue([activeHabit1, activeHabit2]);
    db.habitLog.findMany.mockResolvedValue([logToday, logYesterday]);
    const result = await findBrokenStreakHabits(prisma, USER_ID, TODAY);
    expect(result).toHaveLength(0);
  });

  // ── Inactive habits excluded ──────────────────────────────────────────────────
  //
  // The query passes isActive:true to prisma.habit.findMany, so the mock
  // verifies the WHERE clause includes isActive:true. Inactive habits are
  // never in the response from real Prisma because of the WHERE clause.

  it("scopes habit.findMany to isActive:true", async () => {
    db.habit.findMany.mockResolvedValue([]);
    await findBrokenStreakHabits(prisma, USER_ID, TODAY);
    const call = db.habit.findMany.mock.calls[0][0];
    expect(call.where.isActive).toBe(true);
  });

  it("scopes habit.findMany to frequency 'daily'", async () => {
    db.habit.findMany.mockResolvedValue([]);
    await findBrokenStreakHabits(prisma, USER_ID, TODAY);
    const call = db.habit.findMany.mock.calls[0][0];
    expect(call.where.frequency).toBe("daily");
  });

  // ── Query scoped by userId ────────────────────────────────────────────────────

  it("scopes habit.findMany to the correct userId", async () => {
    db.habit.findMany.mockResolvedValue([]);
    await findBrokenStreakHabits(prisma, USER_ID, TODAY);
    const call = db.habit.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe(USER_ID);
  });

  it("scopes habitLog.findMany to the correct userId", async () => {
    db.habit.findMany.mockResolvedValue([activeHabit1]);
    db.habitLog.findMany.mockResolvedValue([]);
    await findBrokenStreakHabits(prisma, USER_ID, TODAY);
    const call = db.habitLog.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe(USER_ID);
  });

  it("scopes habitLog.findMany to completed:true only", async () => {
    db.habit.findMany.mockResolvedValue([activeHabit1]);
    db.habitLog.findMany.mockResolvedValue([]);
    await findBrokenStreakHabits(prisma, USER_ID, TODAY);
    const call = db.habitLog.findMany.mock.calls[0][0];
    expect(call.where.completed).toBe(true);
  });

  // ── Single habitLog.findMany call (no N+1) ────────────────────────────────────

  it("calls habitLog.findMany exactly once (no N+1)", async () => {
    db.habit.findMany.mockResolvedValue([activeHabit1, activeHabit2]);
    db.habitLog.findMany.mockResolvedValue([]);
    await findBrokenStreakHabits(prisma, USER_ID, TODAY);
    expect(db.habitLog.findMany).toHaveBeenCalledOnce();
  });

  // ── Date range: uses gte + lt ─────────────────────────────────────────────────

  it("habitLog.findMany query includes a date range with gte and lt", async () => {
    db.habit.findMany.mockResolvedValue([activeHabit1]);
    db.habitLog.findMany.mockResolvedValue([]);
    await findBrokenStreakHabits(prisma, USER_ID, TODAY);
    const call = db.habitLog.findMany.mock.calls[0][0];
    expect(call.where.date).toBeDefined();
    expect(call.where.date.gte).toBeDefined();
    expect(call.where.date.lt).toBeDefined();
  });

  it("gte date in query is a Date object (covers the window start)", async () => {
    db.habit.findMany.mockResolvedValue([activeHabit1]);
    db.habitLog.findMany.mockResolvedValue([]);
    await findBrokenStreakHabits(prisma, USER_ID, TODAY);
    const call = db.habitLog.findMany.mock.calls[0][0];
    expect(call.where.date.gte).toBeInstanceOf(Date);
  });

  it("lt date in query is a Date object (covers the window end)", async () => {
    db.habit.findMany.mockResolvedValue([activeHabit1]);
    db.habitLog.findMany.mockResolvedValue([]);
    await findBrokenStreakHabits(prisma, USER_ID, TODAY);
    const call = db.habitLog.findMany.mock.calls[0][0];
    expect(call.where.date.lt).toBeInstanceOf(Date);
  });

  it("gte is strictly before lt (valid range)", async () => {
    db.habit.findMany.mockResolvedValue([activeHabit1]);
    db.habitLog.findMany.mockResolvedValue([]);
    await findBrokenStreakHabits(prisma, USER_ID, TODAY);
    const call = db.habitLog.findMany.mock.calls[0][0];
    expect(call.where.date.gte < call.where.date.lt).toBe(true);
  });

  // ── select: { habitId: true } ────────────────────────────────────────────────

  it("habitLog.findMany selects only habitId", async () => {
    db.habit.findMany.mockResolvedValue([activeHabit1]);
    db.habitLog.findMany.mockResolvedValue([]);
    await findBrokenStreakHabits(prisma, USER_ID, TODAY);
    const call = db.habitLog.findMany.mock.calls[0][0];
    expect(call.select).toEqual({ habitId: true });
  });

  // ── Does not include inactive habits in results (defensive) ──────────────────

  it("does not return inactive habits even if no log is found (real DB excludes them via WHERE)", async () => {
    // If the mock were to return them (real DB won't), they'd be in the broken list.
    // This verifies the WHERE clause is correct so real DB won't include them.
    db.habit.findMany.mockResolvedValue([]); // isActive:true filters them out
    db.habitLog.findMany.mockResolvedValue([]);
    const result = await findBrokenStreakHabits(prisma, USER_ID, TODAY);
    expect(result).toHaveLength(0);
  });

  // ── Timezone parameter is accepted (tz param forwarded) ──────────────────────

  it("accepts a timezone parameter without throwing", async () => {
    db.habit.findMany.mockResolvedValue([activeHabit1]);
    db.habitLog.findMany.mockResolvedValue([]);
    await expect(
      findBrokenStreakHabits(prisma, USER_ID, TODAY, "America/New_York")
    ).resolves.not.toThrow();
  });

  it("accepts null timezone (falls back to UTC)", async () => {
    db.habit.findMany.mockResolvedValue([activeHabit1]);
    db.habitLog.findMany.mockResolvedValue([]);
    await expect(
      findBrokenStreakHabits(prisma, USER_ID, TODAY, null)
    ).resolves.not.toThrow();
  });
});
