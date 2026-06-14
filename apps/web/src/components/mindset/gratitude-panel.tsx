"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { Sun } from "lucide-react";
import { toast } from "sonner";
import { GratitudeForm } from "@/components/mindset/gratitude-form";
import { GratitudeList } from "@/components/mindset/gratitude-list";
import type { GratitudeEntry } from "@secondbrain/types";

interface ApiResponse {
  entries: GratitudeEntry[];
  streak: number;
}

export function GratitudePanel() {
  const [entries, setEntries] = useState<GratitudeEntry[]>([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const todayKey = format(new Date(), "yyyy-MM-dd");
  const todayCount = entries.filter(
    (e) => format(new Date(e.date), "yyyy-MM-dd") === todayKey
  ).length;

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/gratitude");
      const data = await res.json() as ApiResponse;
      setEntries(data.entries);
      setStreak(data.streak);
    } catch {
      toast.error("Failed to load gratitude data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  async function addItem(item: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/gratitude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item }),
      });
      if (res.status === 409) {
        const body = await res.json() as { error: string };
        toast.error(body.error);
        return;
      }
      if (!res.ok) throw new Error();
      toast.success("Gratitude logged");
      await fetchData();
    } catch {
      toast.error("Failed to save gratitude item");
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: string) {
    try {
      const res = await fetch(`/api/gratitude/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await fetchData();
    } catch {
      toast.error("Failed to delete item");
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-secondary/50 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass rounded-xl p-6 space-y-2">
        <div className="flex items-center gap-2 mb-4">
          <Sun className="w-5 h-5 text-amber-400" />
          <h2 className="font-semibold text-sm">
            {streak > 0 ? `🔥 ${streak} day streak` : "Start your streak"}
          </h2>
        </div>
        <GratitudeForm todayCount={todayCount} onAdd={addItem} saving={saving} />
      </div>

      <div className="glass rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-sm">Monthly Summary</h2>
        <GratitudeList entries={entries} onDelete={(id) => void deleteItem(id)} />
      </div>
    </div>
  );
}
