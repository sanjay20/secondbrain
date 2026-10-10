import {
  BOOK_CATEGORIES,
  BOOK_STATUSES,
  type Book,
  type BookCategory,
  type BookLinkTarget,
  type BookStatus,
} from "@secondbrain/types";

// Label/icon maps and derivations for the Books module, following the shape of
// lib/pillars.ts. Keeping the link discrimination in `bookLinkChips` is what
// stops the single-BookLink-table design from leaking null-checks into every
// component that renders a book.

export interface BookStatusMeta {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}

export const BOOK_STATUS_META: Record<BookStatus, BookStatusMeta> = {
  want: {
    label: "Want to read",
    icon: "Bookmark",
    color: "text-slate-400",
    bgColor: "bg-slate-400/10",
  },
  reading: {
    label: "Reading",
    icon: "BookOpen",
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
  },
  finished: {
    label: "Finished",
    icon: "CheckCircle2",
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
  },
};

export function getBookStatusMeta(status: string): BookStatusMeta {
  return (
    BOOK_STATUS_META[status as BookStatus] ?? {
      label: status,
      icon: "Circle",
      color: "text-muted-foreground",
      bgColor: "bg-muted/10",
    }
  );
}

export interface BookCategoryMeta {
  label: string;
  icon: string;
}

export const BOOK_CATEGORY_META: Record<BookCategory, BookCategoryMeta> = {
  technical: { label: "Technical", icon: "💻" },
  spiritual: { label: "Spiritual", icon: "🧘" },
  parenting: { label: "Parenting", icon: "👨‍👩‍👧" },
  finance: { label: "Finance", icon: "💰" },
  health: { label: "Health", icon: "🌱" },
  personal: { label: "Personal", icon: "⭐" },
  other: { label: "Other", icon: "📖" },
};

export function getBookCategoryMeta(category: string): BookCategoryMeta {
  return BOOK_CATEGORY_META[category as BookCategory] ?? { label: category, icon: "📖" };
}

/** Ordered shelf options for filter rows and selects. */
export const BOOK_SHELVES = BOOK_STATUSES.map((value) => ({
  value,
  label: BOOK_STATUS_META[value].label,
}));

export const BOOK_CATEGORY_OPTIONS = BOOK_CATEGORIES.map((value) => ({
  value,
  label: BOOK_CATEGORY_META[value].label,
  icon: BOOK_CATEGORY_META[value].icon,
}));

/**
 * Reading progress as a percentage, or null when there's no page count to
 * measure against — callers hide the bar rather than render a fake 0%.
 */
export function bookProgressPct(book: Pick<Book, "currentPage" | "totalPages">): number | null {
  if (!book.totalPages || book.totalPages <= 0) return null;
  const pct = (book.currentPage / book.totalPages) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export interface BookLinkChip {
  /** The BookLink row id, so unlinking can address it. */
  id: string;
  kind: BookLinkTarget;
  label: string;
  icon?: string;
  /** Status of the linked task, for the task chips only. */
  status?: string;
}

/**
 * Flattens `book.links` into render-ready chips. This is the one place that
 * discriminates on which of the four target FKs is set; a row with none set
 * (which the API should never write) is skipped rather than rendered blank.
 */
export function bookLinkChips(book: Pick<Book, "links">): BookLinkChip[] {
  const chips: BookLinkChip[] = [];

  for (const link of book.links ?? []) {
    if (link.goal) {
      chips.push({ id: link.id, kind: "goal", label: link.goal.title });
    } else if (link.habit) {
      chips.push({ id: link.id, kind: "habit", label: link.habit.name, icon: link.habit.icon });
    } else if (link.skill) {
      chips.push({ id: link.id, kind: "skill", label: link.skill.name });
    } else if (link.task) {
      chips.push({
        id: link.id,
        kind: "task",
        label: link.task.title,
        status: link.task.status,
      });
    }
  }

  return chips;
}

/** Tailwind classes per link kind, so chips read as their source module. */
export const BOOK_LINK_CHIP_CLASS: Record<BookLinkTarget, string> = {
  goal: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  habit: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  skill: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  task: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

/** The linked ids of one target type, for seeding the link editor's checkboxes. */
export function linkedIdsFor(book: Pick<Book, "links">, target: BookLinkTarget): string[] {
  const key = `${target}Id` as const;
  return (book.links ?? [])
    .map((link) => link[key])
    .filter((id): id is string => typeof id === "string");
}
