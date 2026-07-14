"use client";

import { useState } from "react";
import { Quote, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Highlight } from "@secondbrain/types";

interface HighlightCardProps {
  highlight: Highlight;
  onDelete: () => void;
}

export function HighlightCard({ highlight, onDelete }: HighlightCardProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/highlights/${highlight.id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed to delete highlight"); setDeleting(false); return; }
    toast.success("Highlight removed");
    onDelete();
  }

  return (
    <div className="glass rounded-xl p-4 group animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Quote className="w-4 h-4 text-pink-400 shrink-0 mt-1" />
          <p className="text-sm text-foreground italic whitespace-pre-wrap break-words">
            {highlight.text}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          disabled={deleting}
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          title="Delete highlight"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
