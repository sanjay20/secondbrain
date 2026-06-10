import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const updateSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  category: z.string().optional(),
  level: z.number().int().min(1).max(5).optional(),
  description: z.string().max(200).optional().nullable(),
  goalIds: z.array(z.string()).optional(),
});

const skillInclude = {
  skillGoals: {
    include: {
      goal: { select: { id: true, title: true } },
    },
  },
} as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const existing = await prisma.skill.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as unknown;
  let data: z.infer<typeof updateSchema>;
  try {
    data = updateSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    throw err;
  }
  const { goalIds, ...scalars } = data;

  await prisma.skill.update({
    where: { id },
    data: scalars,
  });

  if (goalIds !== undefined) {
    const ownedGoals = await prisma.goal.findMany({
      where: { id: { in: goalIds }, userId: user.id },
      select: { id: true },
    });
    const validGoalIds = ownedGoals.map((g) => g.id);
    await prisma.$transaction([
      prisma.skillGoal.deleteMany({ where: { skillId: id } }),
      prisma.skillGoal.createMany({
        data: validGoalIds.map((goalId) => ({ skillId: id, goalId })),
        skipDuplicates: true,
      }),
    ]);
  }

  const updated = await prisma.skill.findFirst({
    where: { id },
    include: skillInclude,
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const skill = await prisma.skill.findFirst({ where: { id, userId: user.id } });
  if (!skill) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.skill.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
