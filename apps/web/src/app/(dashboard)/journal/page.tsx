"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { NotebookPen, Sparkles, Plus, Trash2, CalendarDays, X, Bell, BellOff } from "lucide-react";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { toast } from "sonner";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { JournalEntry } from "@secondbrain/types";

const CATEGORIES = [
  { value: "work", label: "Work", icon: "💼" },
  { value: "family", label: "Family", icon: "👨‍👩‍👧" },
  { value: "health", label: "Health", icon: "🩺" },
  { value: "incident", label: "Incident", icon: "🚨" },
  { value: "finance", label: "Finance", icon: "💰" },
  { value: "personal", label: "Personal", icon: "⭐" },
  { value: "professional", label: "Professional", icon: "🧑‍💻" },
  { value: "spiritual", label: "Spiritual", icon: "🧘" },
  { value: "other", label: "Other", icon: "📝" },
];

const MOODS = [
  { value: "none", label: "Mood —", icon: "" },
  { value: "great", label: "Great", icon: "😄" },
  { value: "good", label: "Good", icon: "🙂" },
  { value: "neutral", label: "Neutral", icon: "😐" },
  { value: "bad", label: "Bad", icon: "🙁" },
  { value: "terrible", label: "Terrible", icon: "😣" },
];

const categoryMeta = (value: string) =>
  CATEGORIES.find((c) => c.value === value) ?? { value, label: value, icon: "📝" };
const moodIcon = (value?: string | null) =>
  MOODS.find((m) => m.value === value)?.icon ?? "";

const dayKey = (date: Date | string) => format(new Date(date), "yyyy-MM-dd");
const dayLabel = (key: string) => {
  const d = parseISO(key);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, MMMM d, yyyy");
};

// datetime-local input needs "YYYY-MM-DDTHH:mm" format
const toDatetimeLocal = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");
const minDatetime = () => toDatetimeLocal(new Date(Date.now() + 60_000));

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("work");
  const [mood, setMood] = useState("none");
  const [saving, setSaving] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  // entryId → datetime-local string being edited
  const [reminderDraft, setReminderDraft] = useState<Record<string, string>>({});
  const [reminderSaving, setReminderSaving] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const visible = selectedDate
      ? entries.filter((e) => dayKey(e.createdAt) === selectedDate)
      : entries;
    const map = new Map<string, JournalEntry[]>();
    for (const entry of visible) {
      const key = dayKey(entry.createdAt);
      const list = map.get(key);
      if (list) list.push(entry);
      else map.set(key, [entry]);
    }
    return Array.from(map.entries());
  }, [entries, selectedDate]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/journals");
      setEntries(await res.json() as JournalEntry[]);
    } catch {
      toast.error("Failed to load journal");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Register service worker for push notifications
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {/* non-critical */});
    }
  }, []);

  async function addEntry() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/journals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          category,
          ...(mood !== "none" ? { mood } : {}),
        }),
      });
      if (!res.ok) throw new Error();
      setContent("");
      setMood("none");
      toast.success("Event logged");
      fetchData();
    } catch {
      toast.error("Failed to log event");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(id: string) {
    const res = await fetch(`/api/journals/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed to delete"); return; }
    toast.success("Entry deleted");
    fetchData();
  }

  async function getFollowups() {
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/journal-insight", { method: "POST" });
      const data = await res.json() as { insight: string };
      setAiInsight(data.insight);
    } catch {
      toast.error("AI follow-ups unavailable");
    } finally {
      setAiLoading(false);
    }
  }

  async function requestPushPermission() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      return true;
    } catch {
      return false;
    }
  }

  async function setReminder(entryId: string, scheduledAt: string) {
    setReminderSaving((s) => ({ ...s, [entryId]: true }));
    try {
      // Ask for push permission on first reminder set
      if ("Notification" in window && Notification.permission === "default") {
        await requestPushPermission();
      }
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journalEntryId: entryId, scheduledAt: new Date(scheduledAt).toISOString() }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        toast.error(err.error ?? "Failed to set reminder");
        return;
      }
      toast.success("Reminder set");
      setReminderDraft((d) => { const n = { ...d }; delete n[entryId]; return n; });
      fetchData();
    } catch {
      toast.error("Failed to set reminder");
    } finally {
      setReminderSaving((s) => ({ ...s, [entryId]: false }));
    }
  }

  async function cancelReminder(reminderId: string, entryId: string) {
    const res = await fetch(`/api/reminders/${reminderId}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed to cancel reminder"); return; }
    toast.success("Reminder cancelled");
    setReminderDraft((d) => { const n = { ...d }; delete n[entryId]; return n; });
    fetchData();
  }

  return (
    <div className="flex flex-col flex-1">
      <Header title="Journal" subtitle="Log key events — let your coach help you follow up" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {/* Quick log */}
        <div className="glass rounded-xl p-5 space-y-3">
          <Textarea
            placeholder="What happened? e.g. Prep for weekend release — create SNOW change ticket"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); addEntry(); }
            }}
            className="min-h-[80px] resize-none"
          />
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={mood} onValueChange={setMood}>
              <SelectTrigger className="sm:w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MOODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.icon} {m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <Button onClick={addEntry} disabled={saving || !content.trim()} size="sm">
              <Plus className="w-4 h-4" />
              Log event
            </Button>
          </div>
        </div>

        {/* Date filter + AI follow-ups */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <CalendarDays className="w-4 h-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                type="date"
                aria-label="View entries on a date"
                value={selectedDate}
                max={format(new Date(), "yyyy-MM-dd")}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-8 w-[176px] [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer"
              />
            </div>
            {selectedDate ? (
              <Button variant="ghost" size="sm" onClick={() => setSelectedDate("")}>
                <X className="w-3.5 h-3.5" />
                All dates
              </Button>
            ) : (
              <span className="text-sm text-muted-foreground">
                {entries.length} {entries.length === 1 ? "entry" : "entries"}
              </span>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={getFollowups} disabled={aiLoading}>
            <Sparkles className="w-3.5 h-3.5" />
            {aiLoading ? "Thinking..." : "AI Follow-ups"}
          </Button>
        </div>

        {aiInsight && (
          <div className="glass rounded-xl p-5 border-violet-500/20 bg-violet-500/5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-medium text-violet-400">AI Follow-up Coach</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{aiInsight}</p>
          </div>
        )}

        {/* Feed grouped by day */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-secondary/50 animate-pulse" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-violet-400/10 flex items-center justify-center">
              <NotebookPen className="w-8 h-8 text-violet-400" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold">No entries yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Log a key event above — a release, a family plan, an incident, a tough conversation.
              </p>
            </div>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <CalendarDays className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No entries on {format(parseISO(selectedDate), "MMMM d, yyyy")}.
            </p>
            <Button variant="ghost" size="sm" onClick={() => setSelectedDate("")}>
              Show all entries
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map(([day, dayEntries]) => (
              <div key={day} className="space-y-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-foreground shrink-0">{dayLabel(day)}</h3>
                  <div className="h-px bg-border flex-1" />
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {dayEntries.length} {dayEntries.length === 1 ? "event" : "events"}
                  </span>
                </div>
                {dayEntries.map((entry) => {
                  const cat = categoryMeta(entry.category);
                  const reminder = entry.reminder;
                  const draft = reminderDraft[entry.id];
                  const isSaving = reminderSaving[entry.id] ?? false;

                  return (
                    <div key={entry.id} className="glass rounded-xl p-4 group animate-fade-in">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="text-xl shrink-0 mt-0.5">{cat.icon}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground whitespace-pre-wrap break-words">{entry.content}</p>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Badge className="border text-[10px] bg-secondary text-muted-foreground border-border">
                                {cat.icon} {cat.label}
                              </Badge>
                              {entry.mood && moodIcon(entry.mood) && (
                                <span className="text-xs">{moodIcon(entry.mood)}</span>
                              )}
                              <span className="text-[11px] text-muted-foreground">
                                {format(new Date(entry.createdAt), "h:mm a")}
                              </span>

                              {/* Reminder badge */}
                              {reminder?.status === "pending" && (
                                <button
                                  onClick={() => cancelReminder(reminder.id, entry.id)}
                                  className="flex items-center gap-1 text-[11px] text-orange-400 hover:text-destructive transition-colors"
                                  title="Click to cancel reminder"
                                >
                                  <Bell className="w-3 h-3" />
                                  {format(new Date(reminder.scheduledAt), "MMM d, h:mm a")}
                                </button>
                              )}
                              {reminder?.status === "sent" && (
                                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <BellOff className="w-3 h-3" />
                                  Sent {format(new Date(reminder.scheduledAt), "MMM d")}
                                </span>
                              )}
                            </div>

                            {/* Reminder picker (shown when draft is open) */}
                            {draft !== undefined && (
                              <div className="flex items-center gap-2 mt-3">
                                <Input
                                  type="datetime-local"
                                  value={draft}
                                  min={minDatetime()}
                                  onChange={(e) => setReminderDraft((d) => ({ ...d, [entry.id]: e.target.value }))}
                                  className="h-8 text-xs w-auto [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                />
                                <Button
                                  size="sm"
                                  className="h-8 text-xs"
                                  disabled={!draft || isSaving}
                                  onClick={() => setReminder(entry.id, draft)}
                                >
                                  {isSaving ? "Saving…" : "Confirm"}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-xs"
                                  onClick={() => setReminderDraft((d) => { const n = { ...d }; delete n[entry.id]; return n; })}
                                >
                                  Cancel
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Bell button — only show if no pending reminder and draft not open */}
                          {(!reminder || reminder.status === "sent" || reminder.status === "cancelled") && draft === undefined && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setReminderDraft((d) => ({ ...d, [entry.id]: minDatetime() }))}
                              className="text-muted-foreground hover:text-orange-400"
                              title="Set reminder"
                            >
                              <Bell className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteEntry(entry.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
