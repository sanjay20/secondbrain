import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/meals/route";
import { prisma } from "@/lib/db";
import {
  MEAL_NAME_MAX_LEN,
  MEAL_CALORIES_MAX,
  MEAL_MACRO_MAX,
  MEAL_PAGE_LIMIT,
} from "@secondbrain/types";

const db = prisma as unknown as {
  mealEntry: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

// ─── helpers ──────────────────────────────────────────────────────────────────

const makeReq = (body: unknown, url = "http://localhost/api/meals") =>
  ({ json: async () => body, url } as unknown as Request);

const today = new Date();
const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

const sampleMeal = {
  id: "meal-1",
  userId: "user-1",
  name: "Oatmeal with berries",
  mealType: "breakfast",
  calories: 300,
  protein: 10,
  carbs: 50,
  fat: 5,
  date: todayMidnight,
  createdAt: todayMidnight,
  updatedAt: todayMidnight,
};

// ─── GET /api/meals ────────────────────────────────────────────────────────────

describe("GET /api/meals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.mealEntry.findMany.mockResolvedValue([]);
  });

  it("returns 200 with { meals, totals, date }", async () => {
    db.mealEntry.findMany.mockResolvedValue([sampleMeal]);
    const res = await GET(makeReq(null));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("meals");
    expect(body).toHaveProperty("totals");
    expect(body).toHaveProperty("date");
  });

  it("scopes findMany query to the authenticated userId", async () => {
    await GET(makeReq(null));
    const call = db.mealEntry.findMany.mock.calls[0][0];
    expect(call.where).toMatchObject({ userId: "user-1" });
  });

  it("defaults the date filter to today when no ?date param is given", async () => {
    await GET(makeReq(null));
    const call = db.mealEntry.findMany.mock.calls[0][0];
    const filterDate: Date = call.where.date;
    expect(filterDate.getFullYear()).toBe(todayMidnight.getFullYear());
    expect(filterDate.getMonth()).toBe(todayMidnight.getMonth());
    expect(filterDate.getDate()).toBe(todayMidnight.getDate());
    expect(filterDate.getHours()).toBe(0);
  });

  it("uses the ?date query param when provided (resolved to local midnight)", async () => {
    await GET(makeReq(null, "http://localhost/api/meals?date=2026-06-10"));
    const call = db.mealEntry.findMany.mock.calls[0][0];
    const filterDate: Date = call.where.date;
    expect(filterDate.getFullYear()).toBe(2026);
    expect(filterDate.getMonth()).toBe(5); // June = 5 (0-indexed)
    expect(filterDate.getDate()).toBe(10);
    expect(filterDate.getHours()).toBe(0);
  });

  it("applies take: MEAL_PAGE_LIMIT (100) cap on findMany", async () => {
    await GET(makeReq(null));
    const call = db.mealEntry.findMany.mock.calls[0][0];
    expect(call.take).toBe(MEAL_PAGE_LIMIT);
    expect(call.take).toBe(100);
  });

  it("orders by createdAt asc", async () => {
    await GET(makeReq(null));
    const call = db.mealEntry.findMany.mock.calls[0][0];
    expect(call.orderBy).toEqual([{ createdAt: "asc" }]);
  });

  it("returns empty meals array and zeroed totals when the day has no meals (AC-4)", async () => {
    const res = await GET(makeReq(null));
    const body = await res.json();
    expect(body.meals).toEqual([]);
    expect(body.totals).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it("computes server-authoritative totals summing calories/macros across meals (AC-3)", async () => {
    const mealA = { ...sampleMeal, id: "meal-1", calories: 300, protein: 10, carbs: 50, fat: 5 };
    const mealB = {
      ...sampleMeal,
      id: "meal-2",
      mealType: "lunch",
      calories: 200,
      protein: null,
      carbs: 20,
      fat: null,
    };
    db.mealEntry.findMany.mockResolvedValue([mealA, mealB]);
    const res = await GET(makeReq(null));
    const body = await res.json();
    expect(body.totals).toEqual({ calories: 500, protein: 10, carbs: 70, fat: 5 });
  });

  it("treats null macro values as 0 in totals rather than NaN (AC-3)", async () => {
    const mealWithNulls = {
      ...sampleMeal,
      id: "meal-3",
      calories: null,
      protein: null,
      carbs: null,
      fat: null,
    };
    db.mealEntry.findMany.mockResolvedValue([mealWithNulls]);
    const res = await GET(makeReq(null));
    const body = await res.json();
    expect(body.totals).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it("returns the meals list from findMany in the response body", async () => {
    db.mealEntry.findMany.mockResolvedValue([sampleMeal]);
    const res = await GET(makeReq(null));
    const body = await res.json();
    expect(body.meals).toHaveLength(1);
    expect(body.meals[0]).toMatchObject({ id: "meal-1", name: "Oatmeal with berries" });
  });

  it("returns the resolved date as a yyyy-MM-dd string", async () => {
    const res = await GET(makeReq(null, "http://localhost/api/meals?date=2026-06-10"));
    const body = await res.json();
    expect(body.date).toBe("2026-06-10");
  });
});

// ─── POST /api/meals ────────────────────────────────────────────────────────────

describe("POST /api/meals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.mealEntry.create.mockResolvedValue(sampleMeal);
  });

  // Happy path

  it("creates a meal and returns 201 on valid input", async () => {
    const res = await POST(makeReq({ name: "Oatmeal", mealType: "breakfast" }));
    expect(res.status).toBe(201);
  });

  it("persists the correct userId from auth", async () => {
    await POST(makeReq({ name: "Oatmeal", mealType: "breakfast" }));
    const call = db.mealEntry.create.mock.calls[0][0];
    expect(call.data).toMatchObject({ userId: "user-1" });
  });

  it("persists the trimmed name field", async () => {
    await POST(makeReq({ name: "  Oatmeal  ", mealType: "breakfast" }));
    const call = db.mealEntry.create.mock.calls[0][0];
    expect(call.data.name).toBe("Oatmeal");
  });

  it("persists the mealType as provided", async () => {
    await POST(makeReq({ name: "Chicken salad", mealType: "lunch" }));
    const call = db.mealEntry.create.mock.calls[0][0];
    expect(call.data.mealType).toBe("lunch");
  });

  it("defaults date to today when date field is omitted", async () => {
    await POST(makeReq({ name: "Oatmeal", mealType: "breakfast" }));
    const call = db.mealEntry.create.mock.calls[0][0];
    const storedDate: Date = call.data.date;
    expect(storedDate.getFullYear()).toBe(todayMidnight.getFullYear());
    expect(storedDate.getMonth()).toBe(todayMidnight.getMonth());
    expect(storedDate.getDate()).toBe(todayMidnight.getDate());
  });

  it("accepts an explicit date string and stores the resolved date", async () => {
    await POST(makeReq({ name: "Oatmeal", mealType: "breakfast", date: "2026-06-10" }));
    const call = db.mealEntry.create.mock.calls[0][0];
    const storedDate: Date = call.data.date;
    expect(storedDate.getFullYear()).toBe(2026);
    expect(storedDate.getMonth()).toBe(5); // June = 5 (0-indexed)
    expect(storedDate.getDate()).toBe(10);
  });

  it("persists optional calories/protein/carbs/fat when provided", async () => {
    await POST(makeReq({
      name: "Oatmeal",
      mealType: "breakfast",
      calories: 350,
      protein: 12,
      carbs: 55,
      fat: 6,
    }));
    const call = db.mealEntry.create.mock.calls[0][0];
    expect(call.data.calories).toBe(350);
    expect(call.data.protein).toBe(12);
    expect(call.data.carbs).toBe(55);
    expect(call.data.fat).toBe(6);
  });

  it("omits optional macro fields when not provided", async () => {
    await POST(makeReq({ name: "Oatmeal", mealType: "breakfast" }));
    const call = db.mealEntry.create.mock.calls[0][0];
    expect(call.data.calories).toBeUndefined();
    expect(call.data.protein).toBeUndefined();
    expect(call.data.carbs).toBeUndefined();
    expect(call.data.fat).toBeUndefined();
  });

  it("returns the created meal in the response body", async () => {
    const res = await POST(makeReq({ name: "Oatmeal", mealType: "breakfast" }));
    const body = await res.json();
    expect(body).toMatchObject({ id: "meal-1", name: "Oatmeal with berries" });
  });

  // Boundary values → 201

  it(`accepts name of exactly MEAL_NAME_MAX_LEN (${MEAL_NAME_MAX_LEN}) characters → 201`, async () => {
    const res = await POST(makeReq({ name: "A".repeat(MEAL_NAME_MAX_LEN), mealType: "snack" }));
    expect(res.status).toBe(201);
  });

  it("accepts calories of 0 (minimum, nonnegative) → 201", async () => {
    const res = await POST(makeReq({ name: "Water", mealType: "snack", calories: 0 }));
    expect(res.status).toBe(201);
  });

  it(`accepts calories of exactly MEAL_CALORIES_MAX (${MEAL_CALORIES_MAX}) → 201`, async () => {
    const res = await POST(makeReq({ name: "Feast", mealType: "dinner", calories: MEAL_CALORIES_MAX }));
    expect(res.status).toBe(201);
  });

  it(`accepts macro grams of exactly MEAL_MACRO_MAX (${MEAL_MACRO_MAX}) → 201`, async () => {
    const res = await POST(makeReq({
      name: "Feast",
      mealType: "dinner",
      protein: MEAL_MACRO_MAX,
      carbs: MEAL_MACRO_MAX,
      fat: MEAL_MACRO_MAX,
    }));
    expect(res.status).toBe(201);
  });

  // Zod validation — name field

  it("returns 400 when name is empty string", async () => {
    const res = await POST(makeReq({ name: "", mealType: "breakfast" }));
    expect(res.status).toBe(400);
    expect(db.mealEntry.create).not.toHaveBeenCalled();
  });

  it("returns 400 when name is whitespace only (fails min:1 after trim)", async () => {
    const res = await POST(makeReq({ name: "   ", mealType: "breakfast" }));
    expect(res.status).toBe(400);
    expect(db.mealEntry.create).not.toHaveBeenCalled();
  });

  it("returns 400 when name is missing", async () => {
    const res = await POST(makeReq({ mealType: "breakfast" }));
    expect(res.status).toBe(400);
    expect(db.mealEntry.create).not.toHaveBeenCalled();
  });

  it(`returns 400 when name exceeds MEAL_NAME_MAX_LEN (${MEAL_NAME_MAX_LEN}) characters`, async () => {
    const res = await POST(makeReq({ name: "A".repeat(MEAL_NAME_MAX_LEN + 1), mealType: "breakfast" }));
    expect(res.status).toBe(400);
    expect(db.mealEntry.create).not.toHaveBeenCalled();
  });

  // Zod validation — mealType field

  it("returns 400 when mealType is invalid (not in MEAL_TYPES enum)", async () => {
    const res = await POST(makeReq({ name: "Oatmeal", mealType: "brunch" }));
    expect(res.status).toBe(400);
    expect(db.mealEntry.create).not.toHaveBeenCalled();
  });

  it("returns 400 when mealType is missing", async () => {
    const res = await POST(makeReq({ name: "Oatmeal" }));
    expect(res.status).toBe(400);
    expect(db.mealEntry.create).not.toHaveBeenCalled();
  });

  // Zod validation — calories field

  it("returns 400 when calories is negative", async () => {
    const res = await POST(makeReq({ name: "Oatmeal", mealType: "breakfast", calories: -1 }));
    expect(res.status).toBe(400);
    expect(db.mealEntry.create).not.toHaveBeenCalled();
  });

  it(`returns 400 when calories exceeds MEAL_CALORIES_MAX (${MEAL_CALORIES_MAX})`, async () => {
    const res = await POST(makeReq({ name: "Oatmeal", mealType: "breakfast", calories: MEAL_CALORIES_MAX + 1 }));
    expect(res.status).toBe(400);
    expect(db.mealEntry.create).not.toHaveBeenCalled();
  });

  it("returns 400 when calories is a non-integer (float)", async () => {
    const res = await POST(makeReq({ name: "Oatmeal", mealType: "breakfast", calories: 300.5 }));
    expect(res.status).toBe(400);
    expect(db.mealEntry.create).not.toHaveBeenCalled();
  });

  it("returns 400 when calories is a non-numeric string", async () => {
    const res = await POST(makeReq({ name: "Oatmeal", mealType: "breakfast", calories: "lots" }));
    expect(res.status).toBe(400);
    expect(db.mealEntry.create).not.toHaveBeenCalled();
  });

  // Zod validation — macro fields (protein/carbs/fat)

  it("returns 400 when protein is negative", async () => {
    const res = await POST(makeReq({ name: "Oatmeal", mealType: "breakfast", protein: -5 }));
    expect(res.status).toBe(400);
    expect(db.mealEntry.create).not.toHaveBeenCalled();
  });

  it(`returns 400 when protein exceeds MEAL_MACRO_MAX (${MEAL_MACRO_MAX})`, async () => {
    const res = await POST(makeReq({ name: "Oatmeal", mealType: "breakfast", protein: MEAL_MACRO_MAX + 1 }));
    expect(res.status).toBe(400);
    expect(db.mealEntry.create).not.toHaveBeenCalled();
  });

  it("returns 400 when carbs is negative", async () => {
    const res = await POST(makeReq({ name: "Oatmeal", mealType: "breakfast", carbs: -1 }));
    expect(res.status).toBe(400);
    expect(db.mealEntry.create).not.toHaveBeenCalled();
  });

  it("returns 400 when fat is negative", async () => {
    const res = await POST(makeReq({ name: "Oatmeal", mealType: "breakfast", fat: -1 }));
    expect(res.status).toBe(400);
    expect(db.mealEntry.create).not.toHaveBeenCalled();
  });

  // ZodError response shape

  it("returns error array in the 400 response body", async () => {
    const res = await POST(makeReq({ name: "", mealType: "breakfast" }));
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(Array.isArray(body.error)).toBe(true);
  });

  it("does not call create when ZodError is thrown", async () => {
    await POST(makeReq({ name: "", mealType: "breakfast" }));
    expect(db.mealEntry.create).not.toHaveBeenCalled();
  });
});
