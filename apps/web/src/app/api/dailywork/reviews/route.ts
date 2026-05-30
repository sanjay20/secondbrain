import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { weekRange } from "@/lib/datetime";

const reviewContentSchema = z.object({
  completedTasks: z.number().int().min(0),
  totalTasks: z.number().int().min(0),
  habitCompletionRate: z.number().min(0).max(100),
  notes: z.string().max(5000).optional(),
  highlights: z.string().max(2000).optional(),
  improvements: z.string().max(2000).optional(),
});

const createSchema = z.object({
  weekStart: z.coerce.date(),
  content: reviewContentSchema,
});

export async function GET(req: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get("limit");
  const take = limitParam ? parseInt(limitParam) : 10;

  const reviews = await prisma.weeklyReview.findMany({
    where: { userId: user.id },
    orderBy: { weekStart: "desc" },
    take: Math.min(take, 52),
  });

  return NextResponse.json(reviews);
}

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json() as unknown;
  const result = createSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message }, { status: 400 });
  }

  const tz = user.timezone ?? undefined;
  const range = weekRange(result.data.weekStart, tz);

  const review = await prisma.weeklyReview.upsert({
    where: { userId_weekStart: { userId: user.id, weekStart: range.gte } },
    create: {
      userId: user.id,
      weekStart: range.gte,
      weekEnd: new Date(range.lt.getTime() - 1),
      content: result.data.content,
    },
    update: { content: result.data.content },
  });

  return NextResponse.json(review, { status: 201 });
}
