import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  fiveYearGoalId: z.string().min(1),
  title: z.string().min(1).max(200),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Month must be in YYYY-MM format"),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  notes: z.string().max(2000).optional(),
});

export async function GET(req: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const fiveYearGoalId = searchParams.get("fiveYearGoalId");
  const month = searchParams.get("month");

  const goals = await prisma.monthlyGoal.findMany({
    where: {
      userId: user.id,
      ...(fiveYearGoalId ? { fiveYearGoalId } : {}),
      ...(month ? { month } : {}),
    },
    orderBy: [{ month: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(goals);
}

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json() as unknown;
  const result = createSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { fiveYearGoalId, title, month, status, notes } = result.data;

  const parentGoal = await prisma.fiveYearGoal.findFirst({
    where: { id: fiveYearGoalId, userId: user.id },
  });

  if (!parentGoal) {
    return NextResponse.json({ error: "Five-year goal not found" }, { status: 404 });
  }

  const created = await prisma.monthlyGoal.create({
    data: {
      userId: user.id,
      fiveYearGoalId,
      title,
      month,
      status: status ?? "todo",
      notes,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
