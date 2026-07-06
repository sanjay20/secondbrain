"use client";

import { Moon, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { sleepDurationMinutes, formatDuration, type SleepLog } from "@secondbrain/types";

interface SleepCardProps {
  sleepLog: SleepLog;
  onUpdate: () => void;
  onEdit: (log: SleepLog) => void;
}

function formatTime(value: Date | string): string {
  return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function SleepCard({ sleepLog, onUpdate, onEdit }: SleepCardProps) {
  const duration = formatDuration(sleepDurationMinutes(sleepLog.startTime, sleepLog.endTime));

  async function deleteLog() {
    if (!confirm("Delete this sleep entry? This cannot be undone.")) return;
    const res = await fetch(`/api/sleep-logs/${sleepLog.id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed to delete"); return; }
    toast.success("Sleep entry deleted");
    onUpdate();
  }

  return (
    <div className="glass rounded-xl p-4 flex items-center gap-4 group transition-all animate-fade-in">
      <div className="w-10 h-10 rounded-lg bg-indigo-400/10 flex items-center justify-center shrink-0">
        <Moon className="w-5 h-5 text-indigo-400" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-medium text-sm truncate">{formatDate(sleepLog.startTime)}</h4>
          <Badge variant="secondary" className="text-[10px] shrink-0">{duration}</Badge>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatTime(sleepLog.startTime)} → {formatTime(sleepLog.endTime)}
          </span>
          {sleepLog.quality != null && (
            <span className="text-xs text-amber-400 shrink-0">{"★".repeat(sleepLog.quality)}</span>
          )}
        </div>
        {sleepLog.note && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{sleepLog.note}</p>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(sleepLog)}
          className="text-muted-foreground hover:text-foreground"
        >
          <Pencil className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={deleteLog}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
