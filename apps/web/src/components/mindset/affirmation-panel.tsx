"use client";

import { useEffect, useState, useCallback } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AffirmationForm } from "@/components/mindset/affirmation-form";
import { AffirmationList } from "@/components/mindset/affirmation-list";
import type { Affirmation } from "@secondbrain/types";

interface ApiResponse {
  affirmations: Affirmation[];
}

export function AffirmationPanel() {
  const [affirmations, setAffirmations] = useState<Affirmation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/affirmations");
      const data = await res.json() as ApiResponse;
      setAffirmations(data.affirmations);
    } catch {
      toast.error("Failed to load affirmations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  async function addItem(text: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/affirmations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error();
      toast.success("Affirmation added");
      await fetchData();
    } catch {
      toast.error("Failed to save affirmation");
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(id: string) {
    try {
      const res = await fetch(`/api/affirmations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await fetchData();
    } catch {
      toast.error("Failed to delete affirmation");
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
          <Sparkles className="w-5 h-5 text-violet-400" />
          <h2 className="font-semibold text-sm">New Affirmation</h2>
        </div>
        <AffirmationForm onAdd={addItem} saving={saving} />
      </div>

      <div className="glass rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-sm">Your Affirmations</h2>
        <AffirmationList entries={affirmations} onDelete={(id) => void deleteItem(id)} />
      </div>
    </div>
  );
}
