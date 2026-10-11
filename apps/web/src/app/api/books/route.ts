import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  BOOK_AUTHOR_MAX_LEN,
  BOOK_CATEGORIES,
  BOOK_LIST_LIMIT,
  BOOK_MAX_PAGES,
  BOOK_NOTES_MAX_LEN,
  BOOK_RATING_MAX,
  BOOK_RATING_MIN,
  BOOK_STATUSES,
  BOOK_TITLE_MAX_LEN,
  BOOK_URL_MAX_LEN,
  READING_TYPES,
} from "@secondbrain/types";

// Books are ReadingItems; see the Book types section in @secondbrain/types for
// why the model kept its old name. /api/reading-items is left alone on purpose
// — the highlight form still uses it as a plain source picker.

const bookInclude = {
  links: {
    include: {
      goal: { select: { id: true, title: true } },
      habit: { select: { id: true, name: true, icon: true } },
      skill: { select: { id: true, name: true } },
      task: { select: { id: true, title: true, status: true } },
    },
  },
  _count: { select: { highlights: true } },
} as const;

/**
 * `finishedAt` is derived, never accepted from the client. Returns an empty
 * patch when the status isn't changing, so a PATCH that doesn't touch status
 * leaves the existing timestamp alone.
 */
function finishedAtPatch(next: string | undefined, prev: string | undefined) {
  if (next === undefined || next === prev) return {};
  return next === "finished" ? { finishedAt: new Date() } : { finishedAt: null };
}

// No .default() anywhere: this handler upserts on the surviving
// @@unique([userId, title]), and a zod default would make every field
// "present", so the update branch would reset an existing book's shelf status
// back to "want". Prisma's @default covers the create path instead.
const createSchema = z.object({
  title: z.string().trim().min(1).max(BOOK_TITLE_MAX_LEN),
  author: z.string().trim().max(BOOK_AUTHOR_MAX_LEN).optional(),
  type: z.enum(READING_TYPES).optional(),
  status: z.enum(BOOK_STATUSES).optional(),
  category: z.enum(BOOK_CATEGORIES).optional(),
  url: z.string().trim().url().max(BOOK_URL_MAX_LEN).optional(),
  notes: z.string().trim().max(BOOK_NOTES_MAX_LEN).optional(),
  totalPages: z.number().int().min(1).max(BOOK_MAX_PAGES).optional(),
  currentPage: z.number().int().min(0).max(BOOK_MAX_PAGES).optional(),
  rating: z.number().int().min(BOOK_RATING_MIN).max(BOOK_RATING_MAX).optional(),
});

export async function GET(req: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const category = searchParams.get("category");

  // Unknown filter values are ignored rather than passed through, so a typo in
  // the query string yields the full list instead of a confusing empty one.
  const statusFilter =
    status && (BOOK_STATUSES as readonly string[]).includes(status) ? { status } : {};
  const categoryFilter =
    category && (BOOK_CATEGORIES as readonly string[]).includes(category) ? { category } : {};

  const books = await prisma.readingItem.findMany({
    where: { userId: user.id, ...statusFilter, ...categoryFilter },
    include: bookInclude,
    orderBy: { title: "asc" },
    take: BOOK_LIST_LIMIT,
  });

  return NextResponse.json(books);
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

  // Upsert, not create: highlight sources already auto-create reading_items
  // rows, so "add a book I've highlighted" is the common case and a plain
  // create would throw P2002.
  const { title, ...rest } = data;
  const patch = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
  const derived = finishedAtPatch(data.status, undefined);

  const book = await prisma.readingItem.upsert({
    where: { userId_title: { userId: user.id, title } },
    update: { ...patch, ...derived },
    create: { userId: user.id, title, ...patch, ...derived },
    include: bookInclude,
  });

  return NextResponse.json(book, { status: 201 });
}
