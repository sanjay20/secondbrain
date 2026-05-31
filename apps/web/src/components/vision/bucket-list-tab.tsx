"use client";

import { useEffect, useState, useCallback } from "react";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { BucketListCard } from "./bucket-list-card";
import { BucketListForm } from "./bucket-list-form";
import type { BucketListItem } from "@secondbrain/types";

export function BucketListTab() {
  const [items, setItems] = useState<BucketListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/vision/bucket-list");
      setItems((await res.json()) as BucketListItem[]);
    } catch {
      toast.error("Failed to load bucket list");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const completedCount = items.filter((i) => i.completedAt).length;
  const total = items.length;
  const pending = items.filter((i) => !i.completedAt);
  const done = items.filter((i) => i.completedAt);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-fuchsia-400" />
          <span className="font-medium text-sm text-muted-foreground">
            {completedCount} / {total} completed
          </span>
        </div>
        <BucketListForm onSuccess={fetchItems} />
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-secondary/50 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-fuchsia-400/10 flex items-center justify-center">
            <MapPin className="w-8 h-8 text-fuchsia-400" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold">No bucket list items yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Add the experiences, travels, and achievements you want to accomplish in your lifetime.
            </p>
          </div>
          <BucketListForm onSuccess={fetchItems} />
        </div>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Pending</h4>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {pending.map((item) => (
                  <BucketListCard key={item.id} item={item} onUpdate={fetchItems} />
                ))}
              </div>
            </div>
          )}

          {done.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Completed</h4>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {done.map((item) => (
                  <BucketListCard key={item.id} item={item} onUpdate={fetchItems} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
