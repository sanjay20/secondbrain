"use client";

import { format } from "date-fns";
import { Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimeBlock } from "@secondbrain/types";

interface TimelineProps {
  blocks: TimeBlock[];
  gcalEvents?: Array<{ summary: string; start: string; end: string }>;
  onDeleteBlock?: (id: string) => void;
}

function timeLabel(dt: Date): string {
  return format(new Date(dt), "HH:mm");
}

function blockHeight(startTime: Date, endTime: Date): number {
  const minutes = (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000;
  return Math.max(40, minutes); // 1px per minute, minimum 40px
}

export function Timeline({ blocks, gcalEvents = [], onDeleteBlock }: TimelineProps) {
  const allItems = [
    ...blocks.map((b) => ({
      id: b.id,
      label: b.label,
      start: new Date(b.startTime),
      end: new Date(b.endTime),
      type: "block" as const,
      conflict: false,
    })),
    ...gcalEvents.map((ev, i) => ({
      id: `gcal-${i}`,
      label: ev.summary,
      start: new Date(ev.start),
      end: new Date(ev.end),
      type: "gcal" as const,
      conflict: false,
    })),
  ].sort((a, b) => a.start.getTime() - b.start.getTime());

  // Mark conflicts
  for (let i = 0; i < allItems.length; i++) {
    for (let j = i + 1; j < allItems.length; j++) {
      if (allItems[j].start < allItems[i].end) {
        allItems[i].conflict = true;
        allItems[j].conflict = true;
      } else {
        break;
      }
    }
  }

  if (allItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
        <Clock className="w-6 h-6" />
        <p className="text-sm">No time blocks yet. Add one below.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {allItems.map((item) => (
        <div
          key={item.id}
          style={{ minHeight: `${blockHeight(item.start, item.end)}px` }}
          className={cn(
            "rounded-lg px-3 py-2 flex items-start gap-2 group relative",
            item.type === "gcal"
              ? "bg-blue-500/10 border border-blue-500/20"
              : "bg-violet-500/10 border border-violet-500/20",
            item.conflict && "border-orange-400/50"
          )}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{item.label}</p>
            <p className="text-[11px] text-muted-foreground">
              {timeLabel(item.start)} – {timeLabel(item.end)}
              {item.type === "gcal" && " (Google Calendar)"}
            </p>
          </div>
          {item.conflict && (
            <AlertCircle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" aria-label="Time conflict" />
          )}
          {item.type === "block" && onDeleteBlock && (
            <button
              onClick={() => onDeleteBlock(item.id)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive text-xs transition-opacity shrink-0"
              aria-label="Remove block"
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
