import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { parseISO } from "date-fns";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTodayDate } from "@/lib/utils";
import {
  MEAL_TYPES,
  MEAL_NAME_MAX_LEN,
  MEAL_CALORIES_MAX,
  MEAL_MACRO_MAX,
  MEAL_PAGE_LIMIT,
  mealTotals,
} from "@secondbrain/types";

const createSchema = z.object({
  name: z.string().trim().min(1).max(MEAL_NAME_MAX_LEN),
  mealType: z.enum(MEAL_TYPES),
  calories: z.number().int().nonnegative().max(MEAL_CALORIES_MAX).optional(),
  protein: z.number().nonnegative().max(MEAL_MACRO_MAX).optional(),
  carbs: z.number().nonnegative().max(MEAL_MACRO_MAX).optional(),
  fat: z.number().nonnegative().max(MEAL_MACRO_MAX).optional(),
  date: z.string().optional(),
});

// Normalise a yyyy-MM-dd string (or default to today) to a local date-only Date
// so it stores cleanly in the @db.Date column without UTC drift.
function resolveDate(input?: string): Date {
  if (!input) return getTodayDate();
  const parsed = parseISO(input);
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export async function GET(req: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const date = resolveDate(searchParams.get("date") ?? undefined);

  const meals = await prisma.mealEntry.findMany({
    where: { userId: user.id, date },
    orderBy: [{ createdAt: "asc" }],
    take: MEAL_PAGE_LIMIT,
  });

  return NextResponse.json({ meals, totals: mealTotals(meals), date: toDateString(date) });
}

export async function POST(req: Request) {
  const user = await requireUser();
  const body = (await req.json()) as unknown;

  let data: z.infer<typeof createSchema>;
  try {
    data = createSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    throw err;
  }

  const meal = await prisma.mealEntry.create({
    data: {
      userId: user.id,
      name: data.name,
      mealType: data.mealType,
      calories: data.calories,
      protein: data.protein,
      carbs: data.carbs,
      fat: data.fat,
      date: resolveDate(data.date),
    },
  });

  return NextResponse.json(meal, { status: 201 });
}
