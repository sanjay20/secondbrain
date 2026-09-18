import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  LEAK_CATEGORIES,
  LEAK_COST_MAX,
  LEAK_COST_MIN,
  LEAK_DESCRIPTION_MAX_LEN,
  LEAK_ICON_MAX_LEN,
  LEAK_NAME_MAX_LEN,
  PILLARS,
} from "@secondbrain/types";
import { DEFAULT_LEAKS } from "@/lib/life-savings";

const createSchema = z.object({
  name: z.string().trim().min(1).max(LEAK_NAME_MAX_LEN),
  description: z.string().trim().max(LEAK_DESCRIPTION_MAX_LEN).optional(),
  icon: z.string().trim().min(1).max(LEAK_ICON_MAX_LEN).default("⚠️"),
  category: z.enum(LEAK_CATEGORIES).default("other"),
  pillar: z.enum(PILLARS).default("personal"),
  cost: z.number().int().min(LEAK_COST_MIN).max(LEAK_COST_MAX).default(20),
});

/**
 * Seed the starter catalog the first time a user opens the module. Everything
 * seeded is ordinary user data from then on — editable, deletable, and never
 * re-seeded once the user has any leak of their own.
 */
async function seedDefaults(userId: string) {
  await prisma.savingsLeak.createMany({
    data: DEFAULT_LEAKS.map((leak, index) => ({
      userId,
      name: leak.name,
      description: leak.description,
      icon: leak.icon,
      category: leak.category,
      pillar: leak.pillar,
      cost: leak.cost,
      isSeeded: true,
      sortOrder: index,
    })),
    skipDuplicates: true,
  });
}

export async function GET() {
  const user = await requireUser();

  const existing = await prisma.savingsLeak.count({ where: { userId: user.id } });
  if (existing === 0) await seedDefaults(user.id);

  const leaks = await prisma.savingsLeak.findMany({
    where: { userId: user.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(leaks);
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

  const last = await prisma.savingsLeak.findFirst({
    where: { userId: user.id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const leak = await prisma.savingsLeak.create({
    data: { userId: user.id, ...data, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });

  return NextResponse.json(leak, { status: 201 });
}
