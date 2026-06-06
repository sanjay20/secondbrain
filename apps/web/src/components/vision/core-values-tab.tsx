"use client";

import { useEffect, useState, useCallback } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { CoreValueCard } from "./core-value-card";
import { CoreValueForm } from "./core-value-form";
import { MAX_CORE_VALUES } from "@secondbrain/types";
import type { CoreValue } from "@secondbrain/types";

export function CoreValuesTab() {
  const [values, setValues] = useState<CoreValue[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchValues = useCallback(async () => {
    try {
      const res = await fetch("/api/vision/values");
      setValues((await res.json()) as CoreValue[]);
    } catch {
      toast.error("Failed to load core values");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchValues();
  }, [fetchValues]);

  const atMax = values.length >= MAX_CORE_VALUES;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-violet-400" />
          <span className="font-medium text-sm text-muted-foreground">
            {values.length} / {MAX_CORE_VALUES}
          </span>
        </div>
        {atMax ? (
          <div className="text-xs text-muted-foreground">Maximum of 7 core values reached</div>
        ) : (
          <CoreValueForm onSuccess={fetchValues} />
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-secondary/50 animate-pulse" />
          ))}
        </div>
      ) : values.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-violet-400/10 flex items-center justify-center">
            <Heart className="w-8 h-8 text-violet-400" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold">No core values yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Define what you fundamentally stand for — your values will anchor your goals, habits, and AI advice.
            </p>
          </div>
          <CoreValueForm onSuccess={fetchValues} />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {values.map((value) => (
            <CoreValueCard key={value.id} item={value} onUpdate={fetchValues} />
          ))}
        </div>
      )}
    </div>
  );
}
