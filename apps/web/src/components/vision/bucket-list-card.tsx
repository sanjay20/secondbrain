"use client";

import { useState } from "react";
import { Check, RotateCcw, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BucketListForm } from "./bucket-list-form";
import type { BucketListItem } from "@secondbrain/types";

interface BucketListCardProps {
  item: BucketListItem;
  onUpdate: () => void;
}

export function BucketListCard({ item, onUpdate }: BucketListCardProps) {
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isDone = !!item.completedAt;
  const borderColor = isDone ? "#10b981" : "#d946ef";

  async function toggleDone() {
    setUpdating(true);
    try {
      const res = await fetch(`/api/vision/bucket-list/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !isDone }),
      });
      if (!res.ok) throw new Error();
      toast.success(isDone ? "Moved back to pending" : "Marked as done!");
      onUpdate();
    } catch {
      toast.error("Failed to update item");
    } finally {
      setUpdating(false);
    }
  }

  async function deleteItem() {
    if (!confirm("Delete this bucket list item?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/vision/bucket-list/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Item deleted");
      onUpdate();
    } catch {
      toast.error("Failed to delete item");
    } finally {
      setDeleting(false);
    }
  }

  const completedDate = isDone
    ? new Date(item.completedAt as string | Date).toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div
      className={`glass rounded-xl p-5 group animate-fade-in border-l-4 ${isDone ? "opacity-70" : ""}`}
      style={{ borderColor }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="text-xs capitalize shrink-0">
              {item.category}
            </Badge>
          </div>
          <h4 className={`font-semibold text-sm leading-snug ${isDone ? "line-through text-muted-foreground" : ""}`}>
            {item.title}
          </h4>
        </div>

        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <BucketListForm
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
            onClick={toggleDone}
            disabled={updating}
            className={isDone ? "text-muted-foreground hover:text-fuchsia-400" : "text-muted-foreground hover:text-emerald-400"}
          >
            {isDone ? <RotateCcw className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={deleteItem}
            disabled={deleting}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {item.notes && (
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-2">
          {item.notes}
        </p>
      )}

      {completedDate && (
        <p className="text-xs text-emerald-500 mt-1">Completed {completedDate}</p>
      )}
    </div>
  );
}
