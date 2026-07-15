import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CONTACT_NAME_MAX_LEN, CONTACT_NOTES_MAX_LEN, CONTACT_PAGE_LIMIT } from "@secondbrain/types";

const createSchema = z.object({
  name: z.string().trim().min(1).max(CONTACT_NAME_MAX_LEN),
  relationshipType: z.string().trim().min(1).max(50).default("friend"),
  notes: z.string().max(CONTACT_NOTES_MAX_LEN).optional(),
});

export async function GET() {
  const user = await requireUser();

  const contacts = await prisma.contact.findMany({
    where: { userId: user.id },
    orderBy: [{ lastInteractionAt: "asc" }, { createdAt: "asc" }],
    take: CONTACT_PAGE_LIMIT,
  });

  return NextResponse.json(contacts);
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

  const contact = await prisma.contact.create({
    data: { userId: user.id, ...data },
  });

  return NextResponse.json(contact, { status: 201 });
}
