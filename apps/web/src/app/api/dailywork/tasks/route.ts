import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { userDayRange, dateStringToUtc } from "@/lib/datetime";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
  pillar: z.string().max(50).optional(),
  status: z.enum(["todo", "in_progress", "done"]).default("todo"),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  scheduledDate: z.string(),
});

export async function GET(req: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const pillar = searchParams.get("pillar");
  const view = searchParams.get("view") ?? "today";

  const tz = user.timezone ?? undefined;
  const now = new Date();

  let dateFilter: Record<string, unknown> = {};
  if (view === "today") {
    const range = userDayRange(now, tz);
    dateFilter = {
      OR: [
        { scheduledDate: { gte: range.gte, lt: range.lt } },
        { rolledOver: true, completedAt: null },
      ],
    };
  } else if (view === "upcoming") {
    const todayEnd = userDayRange(now, tz).lt;
    dateFilter = { scheduledDate: { gte: todayEnd }, completedAt: null };
  } else if (view === "completed") {
    dateFilter = { completedAt: { not: null } };
  }

  const tasks = await prisma.task.findMany({
    where: {
      userId: user.id,
      ...(pillar ? { pillar } : {}),
      ...dateFilter,
    },
    orderBy: [{ priority: "desc" }, { scheduledDate: "asc" }],
  });

  return NextResponse.json(tasks);
}

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json() as unknown;
  const result = createSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });
  }

  // Interpret the scheduledDate string (yyyy-MM-dd) as midnight in the user's
  // timezone. This matches userDayRange(...).gte so a task scheduled for "today"
  // is included by the view=today filter regardless of the server's timezone.
  const tz = user.timezone ?? undefined;
  const scheduledDate = dateStringToUtc(result.data.scheduledDate, tz);

  const task = await prisma.task.create({
    data: {
      userId: user.id,
      title: result.data.title,
      notes: result.data.notes,
      pillar: result.data.pillar,
      status: result.data.status,
      priority: result.data.priority,
      scheduledDate,
    },
  });

  return NextResponse.json(task, { status: 201 });
}
