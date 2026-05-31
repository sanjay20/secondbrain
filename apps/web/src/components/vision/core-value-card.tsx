"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CoreValueForm } from "./core-value-form";
import type { CoreValue } from "@secondbrain/types";

interface CoreValueCardProps {
  item: CoreValue;
  onUpdate: () => void;
}

export function CoreValueCard({ item, onUpdate }: CoreValueCardProps) {
  const [deleting, setDeleting] = useState(false);

  async function deleteValue() {
    if (!confirm("Delete this core value?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/vision/values/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Value deleted");
      onUpdate();
    } catch {
      toast.error("Failed to delete value");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="glass rounded-xl p-5 group animate-fade-in border-l-4" style={{ borderColor: "#8b5cf6" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm leading-snug">{item.name}</h4>
          {item.description && (
            <p className="text-sm text-muted-foreground leading-relaxed mt-1 line-clamp-3">
              {item.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <CoreValueForm
            item={item}
            onSuccess={onUpdate}
            trigger={
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={deleteValue}
            disabled={deleting}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
