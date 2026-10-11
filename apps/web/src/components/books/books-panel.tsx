"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, CheckCircle2, Library, Quote } from "lucide-react";
import { toast } from "sonner";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BOOK_CATEGORY_OPTIONS, BOOK_SHELVES } from "@/lib/books";
import type { Book, Goal, Habit, Skill } from "@secondbrain/types";
import { BookCard } from "./book-card";
import { BookForm } from "./book-form";
import type { LinkOption } from "./book-link-editor";

const SHELF_FILTERS = [{ value: "all", label: "All" }, ...BOOK_SHELVES];

interface BooksPanelProps {
  /** Nested inside another page (the Knowledge tab) — drop the stats row. */
  embedded?: boolean;
}

export function BooksPanel({ embedded = false }: BooksPanelProps) {
  const [books, setBooks] = useState<Book[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [shelf, setShelf] = useState("all");
  const [category, setCategory] = useState("all");

  const load = useCallback(async () => {
    try {
      // No ?area= on goals or skills: a book can back a career goal as well as
      // a learning one, so the picker needs both.
      const [booksRes, goalsRes, habitsRes, skillsRes] = await Promise.all([
        fetch("/api/books"),
        fetch("/api/goals"),
        fetch("/api/habits"),
        fetch("/api/skills"),
      ]);
      if (!booksRes.ok) throw new Error();
      setBooks((await booksRes.json()) as Book[]);
      // The pickers are best-effort — a book list still works without them.
      if (goalsRes.ok) setGoals((await goalsRes.json()) as Goal[]);
      if (habitsRes.ok) setHabits((await habitsRes.json()) as Habit[]);
      if (skillsRes.ok) setSkills((await skillsRes.json()) as Skill[]);
      setFailed(false);
    } catch {
      setFailed(true);
      toast.error("Failed to load your books");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const goalOptions: LinkOption[] = useMemo(
    () => goals.map((g) => ({ id: g.id, label: g.title })),
    [goals]
  );
  const habitOptions: LinkOption[] = useMemo(
    () => habits.map((h) => ({ id: h.id, label: h.name, icon: h.icon })),
    [habits]
  );
  const skillOptions: LinkOption[] = useMemo(
    () => skills.map((s) => ({ id: s.id, label: s.name })),
    [skills]
  );

  // Filtering is client-side over the single /api/books response (capped at
  // 200). The server's ?status=/?category= filters exist for the API contract;
  // refetching on every toggle would be worse here.
  const visible = useMemo(
    () =>
      books.filter(
        (b) =>
          (shelf === "all" || b.status === shelf) &&
          (category === "all" || b.category === category)
      ),
    [books, shelf, category]
  );

  const counts = useMemo(
    () => ({
      reading: books.filter((b) => b.status === "reading").length,
      finished: books.filter((b) => b.status === "finished").length,
      want: books.filter((b) => b.status === "want").length,
      highlights: books.reduce((sum, b) => sum + (b._count?.highlights ?? 0), 0),
    }),
    [books]
  );

  if (failed && books.length === 0 && !loading) {
    return (
      <p className="text-sm text-muted-foreground">
        Could not load your books. Refresh to try again.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {!embedded && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard title="Reading now" value={counts.reading} icon={BookOpen} iconColor="text-blue-400" />
          <StatsCard title="Finished" value={counts.finished} icon={CheckCircle2} iconColor="text-emerald-400" />
          <StatsCard title="Want to read" value={counts.want} icon={Library} iconColor="text-indigo-400" />
          <StatsCard title="Highlights saved" value={counts.highlights} icon={Quote} iconColor="text-amber-400" />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 text-xs">
          {SHELF_FILTERS.map((option) => (
            <button
              key={option.value}
              onClick={() => setShelf(option.value)}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                shelf === option.value
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All categories</SelectItem>
              {BOOK_CATEGORY_OPTIONS.map((c) => (
                <SelectItem key={c.value} value={c.value} className="text-xs">
                  {c.icon} {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <BookForm onSuccess={load} />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-secondary/50 animate-pulse" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-400/10 flex items-center justify-center">
            <Library className="w-8 h-8 text-indigo-400" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold">
              {books.length === 0 ? "No books yet" : "Nothing on this shelf"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {books.length === 0
                ? "Add a book, then link it to a goal, a habit or a skill."
                : "Try a different shelf or category."}
            </p>
          </div>
          {books.length === 0 ? <BookForm onSuccess={load} /> : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {visible.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              goals={goalOptions}
              habits={habitOptions}
              skills={skillOptions}
              onChanged={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}
