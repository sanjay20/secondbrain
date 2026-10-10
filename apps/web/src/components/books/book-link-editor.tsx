"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { linkedIdsFor } from "@/lib/books";
import type { Book } from "@secondbrain/types";

export interface LinkOption {
  id: string;
  label: string;
  icon?: string;
}

interface BookLinkEditorProps {
  book: Book;
  goals: LinkOption[];
  habits: LinkOption[];
  skills: LinkOption[];
  onChanged: () => void;
}

// A checkbox list per target type, following skill-card.tsx — there is no
// combobox in components/ui, and the lists are short enough not to need one.
function CheckboxList({
  title,
  options,
  selected,
  onToggle,
  accent,
  emptyHint,
}: {
  title: string;
  options: LinkOption[];
  selected: string[];
  onToggle: (id: string) => void;
  accent: string;
  emptyHint: string;
}) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{title}</p>
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground/70 py-1">{emptyHint}</p>
      ) : (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {options.map((o) => (
            <label
              key={o.id}
              className={cn(
                "flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs transition-colors",
                selected.includes(o.id) ? accent : "hover:bg-secondary"
              )}
            >
              <input
                type="checkbox"
                className="accent-blue-500"
                checked={selected.includes(o.id)}
                onChange={() => onToggle(o.id)}
              />
              {o.icon ? <span>{o.icon}</span> : null}
              <span className="truncate">{o.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function BookLinkEditor({ book, goals, habits, skills, onChanged }: BookLinkEditorProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [goalIds, setGoalIds] = useState<string[]>(() => linkedIdsFor(book, "goal"));
  const [habitIds, setHabitIds] = useState<string[]>(() => linkedIdsFor(book, "habit"));
  const [skillIds, setSkillIds] = useState<string[]>(() => linkedIdsFor(book, "skill"));

  function toggle(setter: typeof setGoalIds) {
    return (id: string) =>
      setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // Re-seed from the current book whenever the dialog opens, so a reopen after
  // an external change doesn't save stale selections.
  function onOpenChange(next: boolean) {
    if (next) {
      setGoalIds(linkedIdsFor(book, "goal"));
      setHabitIds(linkedIdsFor(book, "habit"));
      setSkillIds(linkedIdsFor(book, "skill"));
    }
    setOpen(next);
  }

  async function save() {
    setSaving(true);
    try {
      // One PATCH for all three target types. An empty array means "unlink
      // everything of that type", which the API's `!== undefined` check honors.
      const res = await fetch(`/api/books/${book.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalIds, habitIds, skillIds }),
      });
      if (!res.ok) throw new Error();
      toast.success("Links updated");
      setOpen(false);
      onChanged();
    } catch {
      toast.error("Failed to update links");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground h-7 w-7"
          aria-label={`Link ${book.title}`}
        >
          <Link2 className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link &ldquo;{book.title}&rdquo;</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <CheckboxList
            title="Goals"
            options={goals}
            selected={goalIds}
            onToggle={toggle(setGoalIds)}
            accent="bg-blue-500/10 text-blue-400"
            emptyHint="No goals yet — add one in Career or Knowledge."
          />
          <CheckboxList
            title="Habits"
            options={habits}
            selected={habitIds}
            onToggle={toggle(setHabitIds)}
            accent="bg-emerald-500/10 text-emerald-400"
            emptyHint="No active habits yet."
          />
          <CheckboxList
            title="Knowledge & skills"
            options={skills}
            selected={skillIds}
            onToggle={toggle(setSkillIds)}
            accent="bg-violet-500/10 text-violet-400"
            emptyHint="Nothing tracked yet."
          />
          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? "Saving…" : "Save Links"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
