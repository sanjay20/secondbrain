"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PILLAR_TAGS } from "@secondbrain/types";

interface TaskFormProps {
  onSubmit: (data: {
    title: string;
    pillar?: string;
    priority: string;
    scheduledDate: string;
    notes?: string;
  }) => Promise<void>;
  defaultDate?: string;
  loading?: boolean;
}

export function TaskForm({ onSubmit, defaultDate, loading }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [pillar, setPillar] = useState<string>("none");
  const [priority, setPriority] = useState("medium");
  const [scheduledDate, setScheduledDate] = useState(
    defaultDate ?? format(new Date(), "yyyy-MM-dd")
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        pillar: pillar !== "none" ? pillar : undefined,
        priority,
        scheduledDate: new Date(scheduledDate).toISOString(),
      });
      setTitle("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 flex-wrap">
      <Input
        placeholder="New task…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="flex-1 min-w-48"
      />
      <Select value={pillar} onValueChange={setPillar}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Pillar" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No pillar</SelectItem>
          {PILLAR_TAGS.map((p) => (
            <SelectItem key={p} value={p}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={priority} onValueChange={setPriority}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="low">Low</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="critical">Critical</SelectItem>
        </SelectContent>
      </Select>
      <Input
        type="date"
        value={scheduledDate}
        onChange={(e) => setScheduledDate(e.target.value)}
        className="w-40 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer"
      />
      <Button type="submit" size="sm" disabled={submitting || loading || !title.trim()}>
        Add
      </Button>
    </form>
  );
}
