"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { SavingsLeak } from "@secondbrain/types";
import {
  LEAK_CATEGORIES,
  LEAK_COST_MIN,
  LEAK_DESCRIPTION_MAX_LEN,
  LEAK_NAME_MAX_LEN,
} from "@secondbrain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PILLAR_META, VISIBLE_PILLARS } from "@/lib/pillars";

// The API accepts costs up to LEAK_COST_MAX, but a slider that wide is
// unusable — keep the UI in the range where the numbers stay comparable to
// what a habit or a night's sleep earns.
const COST_SLIDER_MAX = 100;

const ICONS = ["⚠️", "🌙", "📱", "🔥", "🌀", "⛓️", "💸", "🚫", "🍔", "🍺", "😶‍🌫️", "⏳"];

const CATEGORY_LABEL: Record<string, string> = {
  energy: "Energy",
  emotion: "Emotion",
  urge: "Urge / compulsion",
  money: "Money",
  plan: "Broken plan",
  other: "Other",
};

interface LeakFormProps {
  /** Null means "create new"; a leak means "edit this one". */
  leak: SavingsLeak | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/**
 * Create or edit one leak. Every seeded leak is editable through here — the
 * wording, the cost and the pillar it counts against are all the user's call.
 */
export function LeakForm({ leak, open, onOpenChange, onSaved }: LeakFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("⚠️");
  const [category, setCategory] = useState<string>("other");
  const [pillar, setPillar] = useState<string>("personal");
  const [cost, setCost] = useState(20);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(leak?.name ?? "");
    setDescription(leak?.description ?? "");
    setIcon(leak?.icon ?? "⚠️");
    setCategory(leak?.category ?? "other");
    setPillar(leak?.pillar ?? "personal");
    setCost(leak?.cost ?? 20);
  }, [open, leak]);

  async function submit() {
    if (!name.trim()) {
      toast.error("Give the leak a name");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        icon,
        category,
        pillar,
        cost,
      };
      const res = await fetch(
        leak ? `/api/savings/leaks/${leak.id}` : "/api/savings/leaks",
        {
          method: leak ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error();
      toast.success(leak ? "Leak updated" : "Leak added");
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error("Could not save that leak");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{leak ? "Edit leak" : "Add a leak"}</DialogTitle>
          <DialogDescription>
            Name it in your own words. The cost is what one occurrence takes off your balance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setIcon(option)}
                  className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${
                    icon === option ? "bg-primary/20 ring-2 ring-primary" : "bg-secondary hover:bg-secondary/80"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="leak-name">Name</Label>
            <Input
              id="leak-name"
              value={name}
              maxLength={LEAK_NAME_MAX_LEN}
              placeholder="e.g. Slept past 2am"
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="leak-description">Description (optional)</Label>
            <Textarea
              id="leak-description"
              value={description}
              maxLength={LEAK_DESCRIPTION_MAX_LEN}
              placeholder="What actually happens when this one hits?"
              className="resize-none min-h-[64px]"
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAK_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABEL[c] ?? c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Counts against</Label>
              <Select value={pillar} onValueChange={setPillar}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIBLE_PILLARS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PILLAR_META[p].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="leak-cost">Cost per occurrence — {cost} credits</Label>
            <input
              id="leak-cost"
              type="range"
              min={LEAK_COST_MIN}
              max={COST_SLIDER_MAX}
              step={5}
              value={Math.min(cost, COST_SLIDER_MAX)}
              onChange={(e) => setCost(Number(e.target.value))}
              className="w-full accent-red-500"
            />
            <p className="text-[11px] text-muted-foreground">
              For reference: one habit ticked off earns 10, a full night&apos;s sleep earns 15.
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={submit} disabled={saving}>
              {saving ? "Saving..." : leak ? "Save changes" : "Add leak"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
