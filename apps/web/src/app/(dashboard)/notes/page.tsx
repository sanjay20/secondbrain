"use client";

import { useEffect, useState, useCallback } from "react";
import { StickyNote, Plus, Trash2, Search, X, Check, Pencil } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { NOTE_CONTENT_MAX_LEN, type Note } from "@secondbrain/types";
import { VISIBLE_NOTE_PILLARS } from "@/lib/pillars";

// Wealth is intentionally absent from the pickers (see VISIBLE_NOTE_PILLARS) but
// keeps its entry here so any pre-existing wealth note still renders a label.
const PILLAR_META: Record<string, { label: string; icon: string; color: string }> = {
  health: { label: "Health", icon: "🩺", color: "text-rose-400" },
  career: { label: "Career", icon: "💼", color: "text-blue-400" },
  wealth: { label: "Wealth", icon: "💰", color: "text-emerald-400" },
  knowledge: { label: "Knowledge", icon: "📖", color: "text-pink-400" },
};

const pillarMeta = (value: string) =>
  PILLAR_META[value] ?? { label: value, icon: "📝", color: "text-muted-foreground" };

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [pillar, setPillar] = useState("knowledge");
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState("");
  const [filterPillar, setFilterPillar] = useState("all");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const fetchNotes = useCallback(async (q: string, pillarFilter: string) => {
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (pillarFilter !== "all") params.set("pillar", pillarFilter);
      const res = await fetch(`/api/notes?${params.toString()}`);
      if (!res.ok) throw new Error();
      setNotes((await res.json()) as Note[]);
    } catch {
      toast.error("Failed to load notes");
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce search + filter changes so we don't fetch on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => fetchNotes(query, filterPillar), 250);
    return () => clearTimeout(t);
  }, [query, filterPillar, fetchNotes]);

  async function addNote() {
    if (!content.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), pillar }),
      });
      if (!res.ok) throw new Error();
      setContent("");
      toast.success("Note saved");
      fetchNotes(query, filterPillar);
    } catch {
      toast.error("Failed to save note");
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(id: string) {
    const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed to delete note"); return; }
    toast.success("Note deleted");
    fetchNotes(query, filterPillar);
  }

  function startEdit(note: Note) {
    setEditingId(note.id);
    setEditContent(note.content);
  }

  async function saveEdit(id: string) {
    if (!editContent.trim()) return;
    const res = await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editContent.trim() }),
    });
    if (!res.ok) { toast.error("Failed to update note"); return; }
    setEditingId(null);
    toast.success("Note updated");
    fetchNotes(query, filterPillar);
  }

  const isSearching = query.trim().length > 0 || filterPillar !== "all";

  return (
    <div className="flex flex-col flex-1">
      <Header title="Notes" subtitle="Capture a quick thought and tag it to a life pillar" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Quick capture */}
        <div className="glass rounded-xl p-5 space-y-3">
          <Textarea
            placeholder="Jot down a quick note… (⌘/Ctrl+Enter to save)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); addNote(); }
            }}
            maxLength={NOTE_CONTENT_MAX_LEN}
            className="min-h-[80px] resize-none"
          />
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Select value={pillar} onValueChange={setPillar}>
              <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VISIBLE_NOTE_PILLARS.map((p) => (
                  <SelectItem key={p} value={p}>{pillarMeta(p).icon} {pillarMeta(p).label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <Button onClick={addNote} disabled={saving || !content.trim()} size="sm">
              <Plus className="w-4 h-4" />
              Add note
            </Button>
          </div>
        </div>

        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              placeholder="Search notes…"
              aria-label="Search notes"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={filterPillar} onValueChange={setFilterPillar}>
            <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All pillars</SelectItem>
              {VISIBLE_NOTE_PILLARS.map((p) => (
                <SelectItem key={p} value={p}>{pillarMeta(p).icon} {pillarMeta(p).label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isSearching && (
            <Button variant="ghost" size="sm" onClick={() => { setQuery(""); setFilterPillar("all"); }}>
              <X className="w-3.5 h-3.5" />
              Clear
            </Button>
          )}
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-secondary/50 animate-pulse" />)}
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-400/10 flex items-center justify-center">
              <StickyNote className="w-8 h-8 text-amber-400" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold">{isSearching ? "No matching notes" : "No notes yet"}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {isSearching
                  ? "Try a different search or clear the filters."
                  : "Capture a quick thought above and tag it to a life pillar."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => {
              const meta = pillarMeta(note.pillar);
              const isEditing = editingId === note.id;
              return (
                <div key={note.id} className="glass rounded-xl p-4 group animate-fade-in">
                  {isEditing ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        maxLength={NOTE_CONTENT_MAX_LEN}
                        className="min-h-[60px] resize-none"
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                        <Button size="sm" disabled={!editContent.trim()} onClick={() => saveEdit(note.id)}>
                          <Check className="w-3.5 h-3.5" />
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground whitespace-pre-wrap break-words">{note.content}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge className="border text-[10px] bg-secondary text-muted-foreground border-border">
                            {meta.icon} {meta.label}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">
                            {format(new Date(note.createdAt), "MMM d, yyyy h:mm a")}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEdit(note)}
                          className="text-muted-foreground hover:text-foreground"
                          title="Edit note"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteNote(note.id)}
                          className="text-muted-foreground hover:text-destructive"
                          title="Delete note"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
