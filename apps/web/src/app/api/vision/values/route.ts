import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MAX_CORE_VALUES } from "@secondbrain/types";

const createSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  description: z.string().max(300).optional(),
});

export async function GET() {
  const user = await requireUser();
  const values = await prisma.coreValue.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    take: MAX_CORE_VALUES,
  });
  return NextResponse.json(values);
}

export async function POST(req: Request) {
  const user = await requireUser();
  const body = (await req.json()) as unknown;
  const result = createSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const count = await prisma.coreValue.count({ where: { userId: user.id } });
  if (count >= MAX_CORE_VALUES) {
    return NextResponse.json(
      { error: "You've reached the maximum of 7 core values" },
      { status: 409 }
    );
  }

  const value = await prisma.coreValue.create({
    data: { ...result.data, userId: user.id },
  });
  return NextResponse.json(value, { status: 201 });
}
