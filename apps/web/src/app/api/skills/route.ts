import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  name: z.string().min(1).max(60),
  area: z.string().default("career"),
  category: z.string().default("technical"),
  level: z.number().int().min(1).max(5).default(1),
  description: z.string().max(200).optional(),
  goalIds: z.array(z.string()).optional(),
});

const skillInclude = {
  skillGoals: {
    include: {
      goal: { select: { id: true, title: true } },
    },
  },
} as const;

export async function GET(req: Request) {
  const user = await requireUser();
  const area = new URL(req.url).searchParams.get("area");
  const skills = await prisma.skill.findMany({
    where: { userId: user.id, ...(area ? { area } : {}) },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: skillInclude,
    take: 200,
  });
  return NextResponse.json(skills);
}

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json() as unknown;
  let data: z.infer<typeof createSchema>;
  try {
    data = createSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    throw err;
  }
  const { goalIds, ...skillData } = data;

  const skill = await prisma.skill.upsert({
    where: { userId_name: { userId: user.id, name: data.name } },
    update: { level: skillData.level, category: skillData.category, description: skillData.description },
    create: { ...skillData, userId: user.id },
    include: skillInclude,
  });

  if (goalIds && goalIds.length > 0) {
    const ownedGoals = await prisma.goal.findMany({
      where: { id: { in: goalIds }, userId: user.id },
      select: { id: true },
    });
    const validGoalIds = ownedGoals.map((g) => g.id);
    await prisma.$transaction([
      prisma.skillGoal.deleteMany({ where: { skillId: skill.id } }),
      prisma.skillGoal.createMany({
        data: validGoalIds.map((goalId) => ({ skillId: skill.id, goalId })),
        skipDuplicates: true,
      }),
    ]);
  }

  const updated = await prisma.skill.findFirst({
    where: { id: skill.id },
    include: skillInclude,
  });

  return NextResponse.json(updated, { status: 201 });
}
