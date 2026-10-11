"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import type { SavingsLeakLog } from "@secondbrain/types";
import { Button } from "@/components/ui/button";

interface HistoryListProps {
  logs: SavingsLeakLog[];
  onChanged: () => void;
}

/** Everything you spent savings on, newest first, with an undo for mis-taps. */
export function HistoryList({ logs, onChanged }: HistoryListProps) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function undo(log: SavingsLeakLog) {
    setBusyId(log.id);
    try {
      const res = await fetch(`/api/savings/logs/${log.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(`+${log.cost * log.intensity} credits returned`);
      onChanged();
    } catch {
      toast.error("Could not undo that");
    } finally {
      setBusyId(null);
    }
  }

  if (logs.length === 0) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Nothing logged yet. When a leak happens, log it — the balance only tells the truth if you do.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div key={log.id} className="glass rounded-xl p-3 flex items-center gap-3">
          <span className="text-lg shrink-0">{log.leak?.icon ?? "⚠️"}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{log.leak?.name ?? "Deleted leak"}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {format(new Date(log.date), "EEE d MMM")}
              {log.intensity > 1 && ` · ×${log.intensity}`}
              {log.note && ` · ${log.note}`}
            </p>
          </div>
          <span className="text-sm font-semibold text-red-400 tabular-nums shrink-0">
            −{log.cost * log.intensity}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => undo(log)}
            disabled={busyId === log.id}
            aria-label="Undo this log"
            title="Undo"
          >
            <Undo2 />
          </Button>
        </div>
      ))}
    </div>
  );
}
