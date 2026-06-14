import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AFFIRMATION_TEXT_MAX_LEN } from "@secondbrain/types";

const createSchema = z.object({
  text: z.string().trim().min(1).max(AFFIRMATION_TEXT_MAX_LEN),
});

export async function GET() {
  const user = await requireUser();

  const affirmations = await prisma.affirmation.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ affirmations });
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

  const affirmation = await prisma.affirmation.create({
    data: { userId: user.id, text: data.text },
  });

  return NextResponse.json(affirmation, { status: 201 });
}
