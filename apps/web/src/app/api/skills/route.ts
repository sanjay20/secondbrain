import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  name: z.string().min(1).max(60),
  area: z.string().default("career"),
  category: z.string().default("technical"),
  level: z.number().int().min(1).max(5).default(1),
  description: z.string().max(200).optional(),
});

export async function GET(req: Request) {
  const user = await requireUser();
  const area = new URL(req.url).searchParams.get("area");
  const skills = await prisma.skill.findMany({
    where: { userId: user.id, ...(area ? { area } : {}) },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(skills);
}

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json() as unknown;
  const data = createSchema.parse(body);

  const skill = await prisma.skill.upsert({
    where: { userId_name: { userId: user.id, name: data.name } },
    update: { level: data.level },
    create: { ...data, userId: user.id },
  });

  return NextResponse.json(skill, { status: 201 });
}
