"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AFFIRMATION_TEXT_MAX_LEN } from "@secondbrain/types";

interface Props {
  onAdd: (text: string) => Promise<void>;
  saving: boolean;
}

export function AffirmationForm({ onAdd, saving }: Props) {
  const [value, setValue] = useState("");

  async function handleAdd() {
    const trimmed = value.trim();
    if (!trimmed) return;
    await onAdd(trimmed);
    setValue("");
  }

  return (
    <div className="flex gap-2">
      <Input
        placeholder="I am..."
        value={value}
        maxLength={AFFIRMATION_TEXT_MAX_LEN}
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
