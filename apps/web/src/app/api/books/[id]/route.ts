import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  BOOK_AUTHOR_MAX_LEN,
  BOOK_CATEGORIES,
  BOOK_LINKS_MAX,
  BOOK_MAX_PAGES,
  BOOK_NOTES_MAX_LEN,
  BOOK_RATING_MAX,
  BOOK_RATING_MIN,
  BOOK_STATUSES,
  BOOK_TITLE_MAX_LEN,
  BOOK_URL_MAX_LEN,
  READING_TYPES,
} from "@secondbrain/types";

// Duplicated from ../route.ts rather than shared, matching how the repo keeps
// `skillInclude` in both skills/route.ts and skills/[id]/route.ts — route
// modules aren't import targets.
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

/** See ../route.ts — `finishedAt` is derived, never accepted from the client. */
function finishedAtPatch(next: string | undefined, prev: string | undefined) {
  if (next === undefined || next === prev) return {};
  return next === "finished" ? { finishedAt: new Date() } : { finishedAt: null };
}

// The clearable fields are .nullable() so the UI can unset them, matching
// skills/[id]/route.ts. No taskIds here — tasks are spawned via
// POST /api/books/[id]/task, not picked from a list.
const updateSchema = z.object({
  title: z.string().trim().min(1).max(BOOK_TITLE_MAX_LEN).optional(),
  author: z.string().trim().max(BOOK_AUTHOR_MAX_LEN).optional().nullable(),
  type: z.enum(READING_TYPES).optional(),
  status: z.enum(BOOK_STATUSES).optional(),
  category: z.enum(BOOK_CATEGORIES).optional(),
  url: z.string().trim().url().max(BOOK_URL_MAX_LEN).optional().nullable(),
  notes: z.string().trim().max(BOOK_NOTES_MAX_LEN).optional().nullable(),
  totalPages: z.number().int().min(1).max(BOOK_MAX_PAGES).optional().nullable(),
  currentPage: z.number().int().min(0).max(BOOK_MAX_PAGES).optional(),
  rating: z.number().int().min(BOOK_RATING_MIN).max(BOOK_RATING_MAX).optional().nullable(),
  goalIds: z.array(z.string()).max(BOOK_LINKS_MAX).optional(),
  habitIds: z.array(z.string()).max(BOOK_LINKS_MAX).optional(),
  skillIds: z.array(z.string()).max(BOOK_LINKS_MAX).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const existing = await prisma.readingItem.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as unknown;
  let data: z.infer<typeof updateSchema>;
  try {
    data = updateSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    throw err;
  }

  const { goalIds, habitIds, skillIds, ...scalars } = data;

  // @@unique([userId, title]) survives, so a rename onto an existing title
  // would throw P2002 and surface as a 500. Check first and say what happened.
  if (scalars.title !== undefined && scalars.title !== existing.title) {
    const clash = await prisma.readingItem.findFirst({
      where: { userId: user.id, title: scalars.title, id: { not: id } },
      select: { id: true },
    });
    if (clash) {
      return NextResponse.json(
        { error: "A book with that title already exists" },
        { status: 409 }
      );
    }
  }

  const derived: Record<string, unknown> = {
    ...finishedAtPatch(scalars.status, existing.status),
  };

  // Page bookkeeping. Inference is deliberately one-directional: finishing a
  // book snaps it to its last page, but correcting a page count never silently
  // rewrites the shelf status.
  const totalPages = scalars.totalPages !== undefined ? scalars.totalPages : existing.totalPages;
  if (scalars.status === "finished" && scalars.status !== existing.status && totalPages) {
    derived.currentPage = totalPages;
  } else if (scalars.currentPage !== undefined) {
    derived.currentPage = Math.min(scalars.currentPage, totalPages ?? BOOK_MAX_PAGES);
  }

  const updateData = { ...scalars, ...derived };
  if (Object.keys(updateData).length > 0) {
    await prisma.readingItem.update({ where: { id }, data: updateData });
  }

  // Each target type is replaced independently. Scoping the deleteMany by
  // `{ [fk]: { not: null } }` is what keeps the three types from clobbering
  // each other, and is what structurally guarantees that every row this writes
  // carries exactly one target FK.
  if (goalIds !== undefined) {
    const owned = await prisma.goal.findMany({
      where: { id: { in: goalIds }, userId: user.id },
      select: { id: true },
    });
    await prisma.$transaction([
      prisma.bookLink.deleteMany({ where: { readingItemId: id, goalId: { not: null } } }),
      prisma.bookLink.createMany({
        data: owned.map((g) => ({ userId: user.id, readingItemId: id, goalId: g.id })),
        skipDuplicates: true,
      }),
    ]);
  }

  if (habitIds !== undefined) {
    const owned = await prisma.habit.findMany({
      where: { id: { in: habitIds }, userId: user.id },
      select: { id: true },
    });
    await prisma.$transaction([
      prisma.bookLink.deleteMany({ where: { readingItemId: id, habitId: { not: null } } }),
      prisma.bookLink.createMany({
        data: owned.map((h) => ({ userId: user.id, readingItemId: id, habitId: h.id })),
        skipDuplicates: true,
      }),
    ]);
  }

  if (skillIds !== undefined) {
    const owned = await prisma.skill.findMany({
      where: { id: { in: skillIds }, userId: user.id },
      select: { id: true },
    });
    await prisma.$transaction([
      prisma.bookLink.deleteMany({ where: { readingItemId: id, skillId: { not: null } } }),
      prisma.bookLink.createMany({
        data: owned.map((s) => ({ userId: user.id, readingItemId: id, skillId: s.id })),
        skipDuplicates: true,
      }),
    ]);
  }

  const updated = await prisma.readingItem.findFirst({ where: { id }, include: bookInclude });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const book = await prisma.readingItem.findFirst({ where: { id, userId: user.id } });
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Highlight.readingItemId cascades, and reading items were undeletable until
  // now — so a careless delete here is the one place this feature can destroy
  // data the user typed. Refuse once, report the real count, and require an
  // explicit ?force=true.
  const highlightCount = await prisma.highlight.count({ where: { readingItemId: id } });
  const force = new URL(req.url).searchParams.get("force") === "true";
  if (highlightCount > 0 && !force) {
    return NextResponse.json(
      { error: "This book has highlights", highlightCount },
      { status: 409 }
    );
  }

  await prisma.readingItem.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
