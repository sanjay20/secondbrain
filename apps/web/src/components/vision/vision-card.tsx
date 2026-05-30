"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { VisionForm } from "./vision-form";
import type { VisionArea } from "@secondbrain/types";

interface VisionCardProps {
  area: VisionArea;
  onUpdate: () => void;
}

export function VisionCard({ area, onUpdate }: VisionCardProps) {
  const [deleting, setDeleting] = useState(false);

  async function deleteArea() {
    if (!confirm(`Delete "${area.name}"?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/vision/${area.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Vision area deleted");
      onUpdate();
    } catch {
      toast.error("Failed to delete vision area");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="glass rounded-xl p-5 group animate-fade-in border-l-4"
      style={{ borderColor: area.color }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="text-2xl shrink-0 mt-0.5">{area.emoji}</div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm truncate">{area.name}</h4>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <VisionForm
            area={area}
            onSuccess={onUpdate}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={deleteArea}
            disabled={deleting}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap line-clamp-4">
        {area.statement}
      </p>
    </div>
  );
}
