/**
 * Unit + smoke tests for the SB-6 Nutrition Log.
 *
 * The project runs Vitest in "node" environment (no DOM / jsdom), so we
 * test pure helpers, type shapes, and logic — not JSX rendering.
 * Mirrors apps/web/src/__tests__/components/workout.test.ts and sleep.test.ts.
 */
import { describe, it, expect } from "vitest";
import {
  MEAL_TYPES,
  MEAL_NAME_MAX_LEN,
  MEAL_CALORIES_MAX,
  MEAL_MACRO_MAX,
  MEAL_PAGE_LIMIT,
  mealTotals,
  type MealEntry,
  type MealTotals,
} from "@secondbrain/types";

// ─── MEAL_* constants ─────────────────────────────────────────────────────────

describe("MEAL constants (consumed by MealForm, MealCard, NutritionLog, and API)", () => {
  it("MEAL_TYPES contains exactly breakfast, lunch, dinner, snack in that order", () => {
    expect(MEAL_TYPES).toEqual(["breakfast", "lunch", "dinner", "snack"]);
  });

  it("MEAL_TYPES has 4 members", () => {
    expect(MEAL_TYPES.length).toBe(4);
  });

  it("MEAL_NAME_MAX_LEN is 200", () => {
    expect(MEAL_NAME_MAX_LEN).toBe(200);
  });

  it("MEAL_CALORIES_MAX is 20000", () => {
    expect(MEAL_CALORIES_MAX).toBe(20000);
  });

  it("MEAL_MACRO_MAX is 2000", () => {
    expect(MEAL_MACRO_MAX).toBe(2000);
  });

  it("MEAL_PAGE_LIMIT is 100", () => {
    expect(MEAL_PAGE_LIMIT).toBe(100);
  });

  it("MEAL_NAME_MAX_LEN is a positive integer", () => {
    expect(Number.isInteger(MEAL_NAME_MAX_LEN)).toBe(true);
    expect(MEAL_NAME_MAX_LEN).toBeGreaterThan(0);
  });

  it("MEAL_CALORIES_MAX is a positive integer", () => {
    expect(Number.isInteger(MEAL_CALORIES_MAX)).toBe(true);
    expect(MEAL_CALORIES_MAX).toBeGreaterThan(0);
  });

  it("MEAL_MACRO_MAX is a positive integer", () => {
    expect(Number.isInteger(MEAL_MACRO_MAX)).toBe(true);
    expect(MEAL_MACRO_MAX).toBeGreaterThan(0);
  });

  it("MEAL_PAGE_LIMIT is a positive integer", () => {
    expect(Number.isInteger(MEAL_PAGE_LIMIT)).toBe(true);
    expect(MEAL_PAGE_LIMIT).toBeGreaterThan(0);
  });

  it("MEAL_CALORIES_MAX is greater than MEAL_MACRO_MAX", () => {
    expect(MEAL_CALORIES_MAX).toBeGreaterThan(MEAL_MACRO_MAX);
  });
});

// ─── MealEntry type shape ─────────────────────────────────────────────────────

describe("MealEntry type contract (consumed by MealCard, MealForm, NutritionLog)", () => {
  it("accepts a valid MealEntry with Date objects", () => {
    const now = new Date();
    const meal: MealEntry = {
      id: "meal-1",
      userId: "user-1",
      name: "Oatmeal",
      mealType: "breakfast",
      date: now,
      createdAt: now,
      updatedAt: now,
    };
    expect(meal.id).toBe("meal-1");
    expect(meal.userId).toBe("user-1");
    expect(meal.mealType).toBe("breakfast");
  });

  it("accepts a MealEntry with string dates (API response shape)", () => {
    const meal: MealEntry = {
      id: "meal-2",
      userId: "user-1",
      name: "Salad",
      mealType: "lunch",
      date: "2026-07-01T00:00:00.000Z",
      createdAt: "2026-07-01T12:00:00.000Z",
      updatedAt: "2026-07-01T12:00:00.000Z",
    };
    expect(meal.date).toBe("2026-07-01T00:00:00.000Z");
  });

  it("accepts a MealEntry with all optional macros provided", () => {
    const meal: MealEntry = {
      id: "meal-3",
      userId: "user-1",
      name: "Steak dinner",
      mealType: "dinner",
      calories: 600,
      protein: 40,
      carbs: 20,
      fat: 30,
      date: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(meal.calories).toBe(600);
    expect(meal.protein).toBe(40);
  });

  it("accepts a MealEntry with null macros (cleared via PATCH)", () => {
    const meal: MealEntry = {
      id: "meal-4",
      userId: "user-1",
      name: "Snack",
      mealType: "snack",
      calories: null,
      protein: null,
      carbs: null,
      fat: null,
      date: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(meal.calories).toBeNull();
    expect(meal.protein).toBeNull();
  });

  it("accepts a MealEntry without macro properties (undefined, never set)", () => {
    const meal: MealEntry = {
      id: "meal-5",
      userId: "user-1",
      name: "Water",
      mealType: "snack",
      date: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(meal.calories).toBeUndefined();
    expect(meal.protein).toBeUndefined();
    expect(meal.carbs).toBeUndefined();
    expect(meal.fat).toBeUndefined();
  });
});

// ─── mealTotals() — pure unit tests (AC-3) ────────────────────────────────────

describe("mealTotals()", () => {
  const makeMeal = (overrides: Partial<MealEntry> = {}): MealEntry => ({
    id: "meal-x",
    userId: "user-1",
    name: "Meal",
    mealType: "breakfast",
    date: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  it("returns zeroed totals for an empty array (AC-4)", () => {
    expect(mealTotals([])).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it("sums calories/protein/carbs/fat across a single meal", () => {
    const meal = makeMeal({ calories: 300, protein: 10, carbs: 50, fat: 5 });
    expect(mealTotals([meal])).toEqual({ calories: 300, protein: 10, carbs: 50, fat: 5 });
  });

  it("sums calories/protein/carbs/fat across multiple meals", () => {
    const mealA = makeMeal({ calories: 300, protein: 10, carbs: 50, fat: 5 });
    const mealB = makeMeal({ calories: 200, protein: 15, carbs: 20, fat: 8 });
    const mealC = makeMeal({ calories: 100, protein: 5, carbs: 10, fat: 2 });
    expect(mealTotals([mealA, mealB, mealC])).toEqual({
      calories: 600,
      protein: 30,
      carbs: 80,
      fat: 15,
    });
  });

  it("treats null macro values as 0 (does not produce NaN)", () => {
    const meal = makeMeal({ calories: null, protein: null, carbs: null, fat: null });
    expect(mealTotals([meal])).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it("treats undefined (omitted) macro values as 0", () => {
    const meal = makeMeal(); // no calories/protein/carbs/fat set
    expect(mealTotals([meal])).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it("handles a mix of set, null, and undefined macros across meals", () => {
    const mealA = makeMeal({ calories: 300, protein: 10 }); // carbs/fat undefined
    const mealB = makeMeal({ calories: null, carbs: 20, fat: null }); // protein undefined
    const result: MealTotals = mealTotals([mealA, mealB]);
    expect(result).toEqual({ calories: 300, protein: 10, carbs: 20, fat: 0 });
  });

  it("does not mutate the input meals array", () => {
    const meal = makeMeal({ calories: 100 });
    const meals = [meal];
    mealTotals(meals);
    expect(meals).toEqual([meal]);
  });
});

// ─── MealForm empty→undefined numeric preprocessing ───────────────────────────

describe("MealForm emptyToUndefined numeric preprocessing (meal-form.tsx)", () => {
  /**
   * Replicates the z.preprocess emptyToUndefined guard in meal-form.tsx:
   *   const emptyToUndefined = (v: unknown) =>
   *     typeof v === "number" && Number.isNaN(v) ? undefined : v;
   * `Input type=number` with valueAsNumber yields NaN for an empty field,
   * which must be treated as "omitted" so the optional Zod field validates.
   */
  function emptyToUndefined(v: unknown): unknown {
    return typeof v === "number" && Number.isNaN(v) ? undefined : v;
  }

  it("converts NaN (empty numeric input) to undefined", () => {
    expect(emptyToUndefined(NaN)).toBeUndefined();
  });

  it("passes through a valid number unchanged", () => {
    expect(emptyToUndefined(300)).toBe(300);
  });

  it("passes through zero unchanged (not treated as empty)", () => {
    expect(emptyToUndefined(0)).toBe(0);
  });

  it("passes through undefined unchanged", () => {
    expect(emptyToUndefined(undefined)).toBeUndefined();
  });

  it("passes through non-number values unchanged (not applicable but must not throw)", () => {
    expect(emptyToUndefined("string")).toBe("string");
  });
});

// ─── NutritionLog empty-state logic ───────────────────────────────────────────

describe("NutritionLog empty-state logic (mirrors conditional rendering, AC-4)", () => {
  /**
   * Mirrors the conditional in nutrition-log.tsx: meals.length === 0 → empty state.
   */
  function shouldShowEmptyState(meals: MealEntry[]): boolean {
    return meals.length === 0;
  }

  const makeMeal = (id: string): MealEntry => ({
    id,
    userId: "u1",
    name: "Meal",
    mealType: "breakfast",
    date: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it("returns true when meals array is empty", () => {
    expect(shouldShowEmptyState([])).toBe(true);
  });

  it("returns false when meals array has one item", () => {
    expect(shouldShowEmptyState([makeMeal("m-1")])).toBe(false);
  });

  it("returns false when meals array has multiple items", () => {
    expect(shouldShowEmptyState([makeMeal("m-1"), makeMeal("m-2")])).toBe(false);
  });
});

// ─── NutritionLog meal-grouping-by-type logic ─────────────────────────────────

describe("NutritionLog grouping-by-mealType logic (mirrors MEAL_TYPES.map + filter)", () => {
  /**
   * Mirrors the grouping loop in nutrition-log.tsx:
   *   MEAL_TYPES.map((type) => meals.filter((m) => m.mealType === type))
   */
  function groupByMealType(meals: MealEntry[]): Record<string, MealEntry[]> {
    const groups: Record<string, MealEntry[]> = {};
    for (const type of MEAL_TYPES) {
      const group = meals.filter((m) => m.mealType === type);
      if (group.length > 0) groups[type] = group;
    }
    return groups;
  }

  const makeMeal = (id: string, mealType: string): MealEntry => ({
    id,
    userId: "u1",
    name: `Meal ${id}`,
    mealType,
    date: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it("groups meals under their mealType key", () => {
    const meals = [makeMeal("m-1", "breakfast"), makeMeal("m-2", "lunch")];
    const groups = groupByMealType(meals);
    expect(groups.breakfast).toHaveLength(1);
    expect(groups.lunch).toHaveLength(1);
  });

  it("omits mealType groups with no meals", () => {
    const meals = [makeMeal("m-1", "breakfast")];
    const groups = groupByMealType(meals);
    expect(groups.breakfast).toBeDefined();
    expect(groups.lunch).toBeUndefined();
    expect(groups.dinner).toBeUndefined();
    expect(groups.snack).toBeUndefined();
  });

  it("groups keys follow MEAL_TYPES order (breakfast, lunch, dinner, snack)", () => {
    const meals = [
      makeMeal("m-1", "snack"),
      makeMeal("m-2", "breakfast"),
      makeMeal("m-3", "dinner"),
      makeMeal("m-4", "lunch"),
    ];
    const groups = groupByMealType(meals);
    expect(Object.keys(groups)).toEqual(["breakfast", "lunch", "dinner", "snack"]);
  });

  it("places multiple meals of the same type into one group", () => {
    const meals = [makeMeal("m-1", "snack"), makeMeal("m-2", "snack"), makeMeal("m-3", "snack")];
    const groups = groupByMealType(meals);
    expect(groups.snack).toHaveLength(3);
  });

  it("returns an empty object for no meals", () => {
    expect(groupByMealType([])).toEqual({});
  });
});
