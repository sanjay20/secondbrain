"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GRATITUDE_MAX_PER_DAY, GRATITUDE_ITEM_MAX_LEN } from "@secondbrain/types";

interface Props {
  todayCount: number;
  onAdd: (item: string) => Promise<void>;
  saving: boolean;
}

export function GratitudeForm({ todayCount, onAdd, saving }: Props) {
  const [value, setValue] = useState("");

  if (todayCount >= GRATITUDE_MAX_PER_DAY) {
    return (
      <p className="text-sm text-muted-foreground text-center py-2">
        You&apos;ve logged your 3 gratitude items for today!
      </p>
    );
  }

  async function handleAdd() {
    const trimmed = value.trim();
    if (!trimmed) return;
    await onAdd(trimmed);
    setValue("");
  }

  return (
    <div className="flex gap-2">
      <Input
        placeholder="I am grateful for..."
        value={value}
        maxLength={GRATITUDE_ITEM_MAX_LEN}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); }}
        disabled={saving}
        className="flex-1"
      />
      <Button onClick={() => void handleAdd()} disabled={!value.trim() || saving}>
        {saving ? "Adding..." : "Add"}
      </Button>
    </div>
  );
}
