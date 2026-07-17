import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH, DELETE } from "@/app/api/meals/[id]/route";
import { prisma } from "@/lib/db";
import { MEAL_NAME_MAX_LEN, MEAL_CALORIES_MAX } from "@secondbrain/types";

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

const makeReq = (body: unknown) =>
  ({ json: async () => body } as unknown as Request);

const makeCtx = (id: string) =>
  ({ params: Promise.resolve({ id }) } as { params: Promise<{ id: string }> });

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

// ─── DELETE /api/meals/[id] ─────────────────────────────────────────────────────

describe("DELETE /api/meals/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.mealEntry.findFirst.mockResolvedValue(sampleMeal);
    db.mealEntry.delete.mockResolvedValue(sampleMeal);
  });

  // Happy path

  it("deletes the meal and returns 200 with { success: true }", async () => {
    const res = await DELETE({} as Request, makeCtx("meal-1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  it("looks up the meal by both id AND userId (ownership check)", async () => {
    await DELETE({} as Request, makeCtx("meal-1"));
    expect(db.mealEntry.findFirst).toHaveBeenCalledWith({
      where: { id: "meal-1", userId: "user-1" },
    });
  });

  it("calls delete with the correct id after ownership is confirmed", async () => {
    await DELETE({} as Request, makeCtx("meal-1"));
    expect(db.mealEntry.delete).toHaveBeenCalledWith({ where: { id: "meal-1" } });
  });

  it("delete is called exactly once on success", async () => {
    await DELETE({} as Request, makeCtx("meal-1"));
    expect(db.mealEntry.delete).toHaveBeenCalledTimes(1);
  });

  // 404 — not found or wrong user (AC-7 multi-tenant isolation)

  it("returns 404 when meal does not exist", async () => {
    db.mealEntry.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("nonexistent"));
    expect(res.status).toBe(404);
    expect(db.mealEntry.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when meal belongs to a different user (ownership check via findFirst scope, AC-7)", async () => {
    // findFirst returns null because the userId in the where clause doesn't match
    db.mealEntry.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("meal-other-user"));
    expect(res.status).toBe(404);
    expect(db.mealEntry.delete).not.toHaveBeenCalled();
  });

  it("returns an error body on 404", async () => {
    db.mealEntry.findFirst.mockResolvedValue(null);
    const res = await DELETE({} as Request, makeCtx("missing"));
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body.error).toBeTruthy();
  });

  it("does not call delete when findFirst returns null", async () => {
    db.mealEntry.findFirst.mockResolvedValue(null);
    await DELETE({} as Request, makeCtx("ghost"));
    expect(db.mealEntry.delete).not.toHaveBeenCalled();
  });

  it("uses the id from route params in the findFirst query", async () => {
    await DELETE({} as Request, makeCtx("some-specific-id"));
    const findFirstCall = db.mealEntry.findFirst.mock.calls[0][0];
    expect(findFirstCall.where.id).toBe("some-specific-id");
  });
});

// ─── PATCH /api/meals/[id] ───────────────────────────────────────────────────────

describe("PATCH /api/meals/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.mealEntry.findFirst.mockResolvedValue(sampleMeal);
    db.mealEntry.update.mockResolvedValue({ ...sampleMeal, name: "Updated meal" });
  });

  // Happy path

  it("updates the meal and returns 200 on valid input", async () => {
    const res = await PATCH(makeReq({ name: "Updated meal" }), makeCtx("meal-1"));
    expect(res.status).toBe(200);
  });

  it("returns the updated meal in the response body", async () => {
    const res = await PATCH(makeReq({ name: "Updated meal" }), makeCtx("meal-1"));
    const body = await res.json();
    expect(body).toHaveProperty("id", "meal-1");
  });

  it("performs the ownership check before calling update", async () => {
    await PATCH(makeReq({ name: "Updated meal" }), makeCtx("meal-1"));
    expect(db.mealEntry.findFirst).toHaveBeenCalledTimes(1);
    expect(db.mealEntry.update).toHaveBeenCalledTimes(1);
    const findFirstOrder = db.mealEntry.findFirst.mock.invocationCallOrder[0];
    const updateOrder = db.mealEntry.update.mock.invocationCallOrder[0];
    expect(findFirstOrder).toBeLessThan(updateOrder);
  });

  it("looks up by both id AND userId (ownership check)", async () => {
    await PATCH(makeReq({ name: "Updated meal" }), makeCtx("meal-1"));
    expect(db.mealEntry.findFirst).toHaveBeenCalledWith({
      where: { id: "meal-1", userId: "user-1" },
    });
  });

  it("calls update with the correct id", async () => {
    await PATCH(makeReq({ name: "Updated meal" }), makeCtx("meal-1"));
    const updateCall = db.mealEntry.update.mock.calls[0][0];
    expect(updateCall.where).toEqual({ id: "meal-1" });
  });

  it("updates only the fields provided (partial update)", async () => {
    await PATCH(makeReq({ name: "Updated meal" }), makeCtx("meal-1"));
    const updateCall = db.mealEntry.update.mock.calls[0][0];
    expect(updateCall.data).toHaveProperty("name", "Updated meal");
    expect(updateCall.data).not.toHaveProperty("mealType");
    expect(updateCall.data).not.toHaveProperty("calories");
    expect(updateCall.data).not.toHaveProperty("date");
  });

  it("trims the name field on update", async () => {
    await PATCH(makeReq({ name: "  Trimmed name  " }), makeCtx("meal-1"));
    const updateCall = db.mealEntry.update.mock.calls[0][0];
    expect(updateCall.data.name).toBe("Trimmed name");
  });

  it("can update mealType to a new value", async () => {
    await PATCH(makeReq({ mealType: "dinner" }), makeCtx("meal-1"));
    const updateCall = db.mealEntry.update.mock.calls[0][0];
    expect(updateCall.data.mealType).toBe("dinner");
  });

  it("can update calories to a new value", async () => {
    await PATCH(makeReq({ calories: 500 }), makeCtx("meal-1"));
    const updateCall = db.mealEntry.update.mock.calls[0][0];
    expect(updateCall.data.calories).toBe(500);
  });

  it("can clear calories by setting it to null", async () => {
    await PATCH(makeReq({ calories: null }), makeCtx("meal-1"));
    const updateCall = db.mealEntry.update.mock.calls[0][0];
    expect(updateCall.data.calories).toBeNull();
  });

  it("can clear protein by setting it to null", async () => {
    await PATCH(makeReq({ protein: null }), makeCtx("meal-1"));
    const updateCall = db.mealEntry.update.mock.calls[0][0];
    expect(updateCall.data.protein).toBeNull();
  });

  it("can clear carbs by setting it to null", async () => {
    await PATCH(makeReq({ carbs: null }), makeCtx("meal-1"));
    const updateCall = db.mealEntry.update.mock.calls[0][0];
    expect(updateCall.data.carbs).toBeNull();
  });

  it("can clear fat by setting it to null", async () => {
    await PATCH(makeReq({ fat: null }), makeCtx("meal-1"));
    const updateCall = db.mealEntry.update.mock.calls[0][0];
    expect(updateCall.data.fat).toBeNull();
  });

  it("resolves and updates date when a date string is provided", async () => {
    await PATCH(makeReq({ date: "2026-06-10" }), makeCtx("meal-1"));
    const updateCall = db.mealEntry.update.mock.calls[0][0];
    expect(updateCall.data.date).toBeInstanceOf(Date);
    expect(updateCall.data.date.getFullYear()).toBe(2026);
    expect(updateCall.data.date.getMonth()).toBe(5);
    expect(updateCall.data.date.getDate()).toBe(10);
  });

  // 404 — ownership failures (AC-7 multi-tenant isolation)

  it("returns 404 when the meal does not exist", async () => {
    db.mealEntry.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq({ name: "Updated meal" }), makeCtx("nonexistent"));
    expect(res.status).toBe(404);
    expect(db.mealEntry.update).not.toHaveBeenCalled();
  });

  it("returns 404 when the meal belongs to a different user (AC-7)", async () => {
    db.mealEntry.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq({ name: "Updated meal" }), makeCtx("meal-other-user"));
    expect(res.status).toBe(404);
    expect(db.mealEntry.update).not.toHaveBeenCalled();
  });

  it("returns an error body on 404", async () => {
    db.mealEntry.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq({ name: "Updated meal" }), makeCtx("missing"));
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body.error).toBeTruthy();
  });

  it("does not call findFirst body parsing before ownership check fails (update never reached)", async () => {
    db.mealEntry.findFirst.mockResolvedValue(null);
    await PATCH(makeReq({ name: "Updated meal" }), makeCtx("ghost"));
    expect(db.mealEntry.update).not.toHaveBeenCalled();
  });

  // 400 — Zod validation failures

  it("returns 400 when mealType is invalid", async () => {
    const res = await PATCH(makeReq({ mealType: "brunch" }), makeCtx("meal-1"));
    expect(res.status).toBe(400);
    expect(db.mealEntry.update).not.toHaveBeenCalled();
  });

  it(`returns 400 when name exceeds MEAL_NAME_MAX_LEN (${MEAL_NAME_MAX_LEN}) characters`, async () => {
    const res = await PATCH(makeReq({ name: "A".repeat(MEAL_NAME_MAX_LEN + 1) }), makeCtx("meal-1"));
    expect(res.status).toBe(400);
    expect(db.mealEntry.update).not.toHaveBeenCalled();
  });

  it("returns 400 when name is empty string", async () => {
    const res = await PATCH(makeReq({ name: "" }), makeCtx("meal-1"));
    expect(res.status).toBe(400);
    expect(db.mealEntry.update).not.toHaveBeenCalled();
  });

  it("returns 400 when calories is negative", async () => {
    const res = await PATCH(makeReq({ calories: -1 }), makeCtx("meal-1"));
    expect(res.status).toBe(400);
    expect(db.mealEntry.update).not.toHaveBeenCalled();
  });

  it(`returns 400 when calories exceeds MEAL_CALORIES_MAX (${MEAL_CALORIES_MAX})`, async () => {
    const res = await PATCH(makeReq({ calories: MEAL_CALORIES_MAX + 1 }), makeCtx("meal-1"));
    expect(res.status).toBe(400);
    expect(db.mealEntry.update).not.toHaveBeenCalled();
  });

  it("returns error body on 400", async () => {
    const res = await PATCH(makeReq({ mealType: "brunch" }), makeCtx("meal-1"));
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});
