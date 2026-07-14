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
} from "@secondbrain/types";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(MEAL_NAME_MAX_LEN).optional(),
  mealType: z.enum(MEAL_TYPES).optional(),
  calories: z.number().int().nonnegative().max(MEAL_CALORIES_MAX).nullable().optional(),
  protein: z.number().nonnegative().max(MEAL_MACRO_MAX).nullable().optional(),
  carbs: z.number().nonnegative().max(MEAL_MACRO_MAX).nullable().optional(),
  fat: z.number().nonnegative().max(MEAL_MACRO_MAX).nullable().optional(),
  date: z.string().optional(),
});

function resolveDate(input: string): Date {
  const parsed = parseISO(input);
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const existing = await prisma.mealEntry.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as unknown;
  let data: z.infer<typeof updateSchema>;
  try {
    data = updateSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    throw err;
  }

  const meal = await prisma.mealEntry.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.mealType !== undefined ? { mealType: data.mealType } : {}),
      ...(data.calories !== undefined ? { calories: data.calories } : {}),
      ...(data.protein !== undefined ? { protein: data.protein } : {}),
      ...(data.carbs !== undefined ? { carbs: data.carbs } : {}),
      ...(data.fat !== undefined ? { fat: data.fat } : {}),
      ...(data.date !== undefined ? { date: resolveDate(data.date) } : {}),
    },
  });

  return NextResponse.json(meal);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const meal = await prisma.mealEntry.findFirst({ where: { id, userId: user.id } });
  if (!meal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.mealEntry.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
