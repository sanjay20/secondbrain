import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  area: z.string().default("career"),
  category: z.string().default("career"),
  priority: z.string().default("medium"),
  dueDate: z.string().optional(),
});

export async function GET(req: Request) {
  const user = await requireUser();
  const area = new URL(req.url).searchParams.get("area");

  const goals = await prisma.goal.findMany({
    where: { userId: user.id, ...(area ? { area } : {}) },
    include: { milestones: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(goals);
}

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json() as unknown;
  const data = createSchema.parse(body);

  const goal = await prisma.goal.create({
    data: {
      ...data,
      userId: user.id,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    },
    include: { milestones: true },
  });

  return NextResponse.json(goal, { status: 201 });
}
