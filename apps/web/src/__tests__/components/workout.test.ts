/**
 * Smoke tests for workout components, constants, and data-transformation logic.
 *
 * The project runs Vitest in "node" environment (no DOM / jsdom), so we
 * verify the type shapes, constants, and logic rather than rendering JSX.
 * This mirrors the gratitude.test.ts / affirmations.test.ts approach.
 */
import { describe, it, expect } from "vitest";
import {
  WORKOUT_TYPE_MAX_LEN,
  WORKOUT_NOTES_MAX_LEN,
  WORKOUT_PAGE_LIMIT,
} from "@secondbrain/types";
import type { Workout } from "@secondbrain/types";
import { startOfWeek, endOfWeek, format } from "date-fns";

// ─── WORKOUT_* constants ──────────────────────────────────────────────────────

describe("WORKOUT constants (consumed by WorkoutForm, WorkoutCard, and API)", () => {
  it("WORKOUT_TYPE_MAX_LEN is 50", () => {
    expect(WORKOUT_TYPE_MAX_LEN).toBe(50);
  });

  it("WORKOUT_NOTES_MAX_LEN is 500", () => {
    expect(WORKOUT_NOTES_MAX_LEN).toBe(500);
  });

  it("WORKOUT_PAGE_LIMIT is 50", () => {
    expect(WORKOUT_PAGE_LIMIT).toBe(50);
  });

  it("WORKOUT_TYPE_MAX_LEN is a positive integer", () => {
    expect(Number.isInteger(WORKOUT_TYPE_MAX_LEN)).toBe(true);
    expect(WORKOUT_TYPE_MAX_LEN).toBeGreaterThan(0);
  });

  it("WORKOUT_NOTES_MAX_LEN is a positive integer", () => {
    expect(Number.isInteger(WORKOUT_NOTES_MAX_LEN)).toBe(true);
    expect(WORKOUT_NOTES_MAX_LEN).toBeGreaterThan(0);
  });

  it("WORKOUT_PAGE_LIMIT is a positive integer", () => {
    expect(Number.isInteger(WORKOUT_PAGE_LIMIT)).toBe(true);
    expect(WORKOUT_PAGE_LIMIT).toBeGreaterThan(0);
  });

  it("WORKOUT_NOTES_MAX_LEN is greater than WORKOUT_TYPE_MAX_LEN", () => {
    expect(WORKOUT_NOTES_MAX_LEN).toBeGreaterThan(WORKOUT_TYPE_MAX_LEN);
  });
});

// ─── Workout type shape ───────────────────────────────────────────────────────

describe("Workout type contract (consumed by WorkoutCard and WorkoutLog)", () => {
  it("accepts a valid Workout with Date objects", () => {
    const today = new Date();
    const workout: Workout = {
      id: "wo-1",
      userId: "user-1",
      type: "Running",
      duration: 30,
      date: today,
      createdAt: today,
    };

    expect(workout.id).toBe("wo-1");
    expect(workout.userId).toBe("user-1");
    expect(workout.type).toBe("Running");
    expect(workout.duration).toBe(30);
  });

  it("accepts a Workout with string dates (API response shape)", () => {
    const workout: Workout = {
      id: "wo-2",
      userId: "user-1",
      type: "Cycling",
      duration: 45,
      date: "2026-06-14T00:00:00.000Z",
      createdAt: "2026-06-14T08:00:00.000Z",
    };

    expect(workout.date).toBe("2026-06-14T00:00:00.000Z");
    expect(workout.createdAt).toBe("2026-06-14T08:00:00.000Z");
  });

  it("accepts a Workout with optional notes", () => {
    const workout: Workout = {
      id: "wo-3",
      userId: "user-1",
      type: "Yoga",
      duration: 60,
      notes: "Felt calm",
      date: new Date(),
      createdAt: new Date(),
    };
    expect(workout.notes).toBe("Felt calm");
  });

  it("accepts a Workout with null notes (optional, may be null from Prisma)", () => {
    const workout: Workout = {
      id: "wo-4",
      userId: "user-1",
      type: "Yoga",
      duration: 60,
      notes: null,
      date: new Date(),
      createdAt: new Date(),
    };
    expect(workout.notes).toBeNull();
  });

  it("accepts a Workout without notes property (undefined)", () => {
    const workout: Workout = {
      id: "wo-5",
      userId: "user-1",
      type: "Swimming",
      duration: 20,
      date: new Date(),
      createdAt: new Date(),
    };
    expect(workout.notes).toBeUndefined();
  });

  it("duration is a number", () => {
    const workout: Workout = {
      id: "wo-6",
      userId: "user-1",
      type: "HIIT",
      duration: 25,
      date: new Date(),
      createdAt: new Date(),
    };
    expect(typeof workout.duration).toBe("number");
  });
});

// ─── WorkoutForm Zod schema logic (free-text type field) ─────────────────────

describe("WorkoutForm type field validation (WORKOUT_TYPE_MAX_LEN = 50)", () => {
  /**
   * Replicates the Zod z.string().trim().min(1).max(WORKOUT_TYPE_MAX_LEN)
   * guard used in workout-form.tsx and the API route schema.
   */
  function isTypeValid(value: string): boolean {
    const trimmed = value.trim();
    return trimmed.length >= 1 && trimmed.length <= WORKOUT_TYPE_MAX_LEN;
  }

  it("returns false for empty string", () => {
    expect(isTypeValid("")).toBe(false);
  });

  it("returns false for whitespace-only string", () => {
    expect(isTypeValid("   ")).toBe(false);
  });

  it("returns true for a single character", () => {
    expect(isTypeValid("R")).toBe(true);
  });

  it("returns true for a typical workout type", () => {
    expect(isTypeValid("Running")).toBe(true);
  });

  it("returns true for exactly WORKOUT_TYPE_MAX_LEN characters (boundary)", () => {
    expect(isTypeValid("A".repeat(WORKOUT_TYPE_MAX_LEN))).toBe(true);
  });

  it("returns false for type longer than WORKOUT_TYPE_MAX_LEN", () => {
    expect(isTypeValid("A".repeat(WORKOUT_TYPE_MAX_LEN + 1))).toBe(false);
  });
});

// ─── WorkoutForm Zod schema logic (duration field with valueAsNumber) ─────────

describe("WorkoutForm duration field validation", () => {
  /**
   * Replicates the z.number().int().positive() guard in workout-form.tsx.
   * valueAsNumber: true converts the input string to a number; an empty input
   * becomes NaN which fails the z.number() type check.
   */
  function isDurationValid(value: number): boolean {
    return Number.isInteger(value) && value > 0;
  }

  it("returns false for NaN (empty input via valueAsNumber)", () => {
    expect(isDurationValid(NaN)).toBe(false);
  });

  it("returns false for 0", () => {
    expect(isDurationValid(0)).toBe(false);
  });

  it("returns false for negative numbers", () => {
    expect(isDurationValid(-1)).toBe(false);
  });

  it("returns false for floats", () => {
    expect(isDurationValid(30.5)).toBe(false);
  });

  it("returns true for 1 (minimum positive integer)", () => {
    expect(isDurationValid(1)).toBe(true);
  });

  it("returns true for typical duration of 30", () => {
    expect(isDurationValid(30)).toBe(true);
  });

  it("returns true for large duration (300 min = 5 hours)", () => {
    expect(isDurationValid(300)).toBe(true);
  });
});

// ─── Weekly count boundary date logic (weekStartsOn: 1 = Mon–Sun) ─────────────

describe("weekly count window boundary logic (weekStartsOn:1 Mon–Sun)", () => {
  /**
   * Mirrors the startOfWeek/endOfWeek calls in GET /api/workouts.
   * We verify that dates inside/outside the Mon–Sun window behave correctly.
   */
  function isInWeek(dateToCheck: Date, referenceDate: Date): boolean {
    const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 });
    return dateToCheck >= weekStart && dateToCheck <= weekEnd;
  }

  // Use a known Monday as a reference: 2026-06-08 is a Monday
  const knownMonday = new Date(2026, 5, 8); // Jun 8, 2026

  it("Monday itself is inside the Mon–Sun week", () => {
    expect(isInWeek(knownMonday, knownMonday)).toBe(true);
  });

  it("Tuesday of the same week is inside the window", () => {
    const tuesday = new Date(2026, 5, 9);
    expect(isInWeek(tuesday, knownMonday)).toBe(true);
  });

  it("Sunday (end of week) is inside the window", () => {
    const sunday = new Date(2026, 5, 14); // Jun 14, 2026 = Sunday
    expect(isInWeek(sunday, knownMonday)).toBe(true);
  });

  it("next Monday (start of following week) is OUTSIDE the window", () => {
    const nextMonday = new Date(2026, 5, 15); // Jun 15, 2026 = Monday
    expect(isInWeek(nextMonday, knownMonday)).toBe(false);
  });

  it("previous Sunday (last week) is OUTSIDE the window", () => {
    const prevSunday = new Date(2026, 5, 7); // Jun 7, 2026 = Sunday (prev week)
    expect(isInWeek(prevSunday, knownMonday)).toBe(false);
  });

  it("week window always starts on Monday (day index 1)", () => {
    const weekStart = startOfWeek(knownMonday, { weekStartsOn: 1 });
    expect(weekStart.getDay()).toBe(1); // 1 = Monday in JS
  });

  it("week window always ends on Sunday (day index 0)", () => {
    const weekEnd = endOfWeek(knownMonday, { weekStartsOn: 1 });
    expect(weekEnd.getDay()).toBe(0); // 0 = Sunday in JS
  });

  it("a date 7 days before the reference week start is outside the window", () => {
    const sevenDaysBefore = new Date(2026, 5, 1); // Jun 1, 2026
    expect(isInWeek(sevenDaysBefore, knownMonday)).toBe(false);
  });
});

// ─── resolveDate logic (date-only normalisation) ──────────────────────────────

describe("resolveDate helper logic (normalises yyyy-MM-dd to midnight local Date)", () => {
  /**
   * Replicates the resolveDate helper in apps/web/src/app/api/workouts/route.ts.
   * Ensures the @db.Date column gets a local-midnight Date (no UTC drift).
   */
  function resolveDate(input?: string): Date {
    if (!input) {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    // parseISO equivalent: parse the yyyy-MM-dd parts
    const [year, month, day] = input.split("-").map(Number);
    return new Date(year!, (month! - 1), day!);
  }

  it("returns today at midnight when input is undefined", () => {
    const result = resolveDate(undefined);
    const now = new Date();
    expect(result.getFullYear()).toBe(now.getFullYear());
    expect(result.getMonth()).toBe(now.getMonth());
    expect(result.getDate()).toBe(now.getDate());
    expect(result.getHours()).toBe(0);
  });

  it("returns today at midnight when input is empty string", () => {
    // Empty string is falsy so falls into default branch
    const result = resolveDate("");
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });

  it("parses 2026-06-10 correctly", () => {
    const result = resolveDate("2026-06-10");
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(5); // June = 5 (0-indexed)
    expect(result.getDate()).toBe(10);
    expect(result.getHours()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it("parses a January date correctly", () => {
    const result = resolveDate("2026-01-01");
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0); // January = 0
    expect(result.getDate()).toBe(1);
  });

  it("parses a December date correctly", () => {
    const result = resolveDate("2026-12-31");
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(11); // December = 11
    expect(result.getDate()).toBe(31);
  });

  it("result is a local-midnight Date (no time component drift)", () => {
    const result = resolveDate("2026-03-15");
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it("result formats back to the original yyyy-MM-dd string", () => {
    const result = resolveDate("2026-06-10");
    expect(format(result, "yyyy-MM-dd")).toBe("2026-06-10");
  });
});

// ─── WorkoutLog empty-state logic ─────────────────────────────────────────────

describe("WorkoutLog empty-state logic (mirrors conditional rendering)", () => {
  /**
   * Mirrors the conditional: if (workouts.length === 0) show empty state.
   */
  function shouldShowEmptyState(workouts: Workout[]): boolean {
    return workouts.length === 0;
  }

  it("returns true when workouts array is empty", () => {
    expect(shouldShowEmptyState([])).toBe(true);
  });

  it("returns false when workouts array has one item", () => {
    const w: Workout = { id: "wo-1", userId: "u1", type: "Running", duration: 30, date: new Date(), createdAt: new Date() };
    expect(shouldShowEmptyState([w])).toBe(false);
  });

  it("returns false when workouts array has multiple items", () => {
    const makeW = (id: string): Workout => ({ id, userId: "u1", type: "Running", duration: 30, date: new Date(), createdAt: new Date() });
    expect(shouldShowEmptyState([makeW("a"), makeW("b")])).toBe(false);
  });
});
