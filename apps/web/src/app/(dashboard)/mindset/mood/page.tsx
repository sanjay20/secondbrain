"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { Smile } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MoodSelector } from "@/components/mindset/mood-selector";
import { MoodChart } from "@/components/mindset/mood-chart";
import type { MoodLog } from "@secondbrain/types";

export default function MoodPage() {
  const [entries, setEntries] = useState<MoodLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const todayKey = format(new Date(), "yyyy-MM-dd");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/mood");
      const data = await res.json() as MoodLog[];
      setEntries(data);
      const todayEntry = data.find(
        (e) => format(new Date(e.date), "yyyy-MM-dd") === todayKey
      );
      if (todayEntry) {
        setSelectedMood(todayEntry.mood);
        setNote(todayEntry.note ?? "");
      }
    } catch {
      toast.error("Failed to load mood data");
    } finally {
      setLoading(false);
    }
  }, [todayKey]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function saveMood() {
    if (!selectedMood) return;
    setSaving(true);
    try {
      const res = await fetch("/api/mood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood: selectedMood, note: note.trim() || undefined }),
      });
      if (!res.ok) throw new Error();
      toast.success("Mood logged");
      fetchData();
    } catch {
      toast.error("Failed to save mood");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col flex-1">
      <Header title="Mood" subtitle="Track your daily emotional state" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-secondary/50 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="glass rounded-xl p-6 space-y-5">
              <div className="flex items-center gap-2">
                <Smile className="w-5 h-5 text-rose-400" />
                <h2 className="font-semibold text-sm">How are you feeling today?</h2>
              </div>

              <MoodSelector value={selectedMood} onChange={setSelectedMood} />

              <Textarea
                placeholder="Optional note (max 500 chars)"
                value={note}
                maxLength={500}
                onChange={(e) => setNote(e.target.value)}
                className="resize-none min-h-[72px]"
              />

              <Button
                onClick={saveMood}
                disabled={!selectedMood || saving}
                className="w-full"
              >
                {saving ? "Saving..." : "Save mood"}
              </Button>
            </div>

            <div className="glass rounded-xl p-5 space-y-3">
              <h2 className="font-semibold text-sm">7-day trend</h2>
              <MoodChart data={entries} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
