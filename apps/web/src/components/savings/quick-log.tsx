"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import type { SavingsLeak } from "@secondbrain/types";
import { LEAK_INTENSITY_MAX, LEAK_INTENSITY_MIN, LEAK_NOTE_MAX_LEN } from "@secondbrain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const INTENSITY_LABEL: Record<number, string> = {
  1: "Once / mild",
  2: "Repeated",
  3: "All day",
};

interface QuickLogProps {
  leaks: SavingsLeak[];
  onLogged: () => void;
}

/**
 * The one screen the user touches daily: tap the leak that happened, optionally
 * say how heavy it was, and the cost comes straight off the balance.
 */
export function QuickLog({ leaks, onLogged }: QuickLogProps) {
  const [active, setActive] = useState<SavingsLeak | null>(null);
  const [intensity, setIntensity] = useState(1);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const activeLeaks = leaks.filter((l) => l.isActive);

  function open(leak: SavingsLeak) {
    setActive(leak);
    setIntensity(1);
    setNote("");
  }

  async function submit() {
    if (!active) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/savings/leaks/${active.id}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intensity, note: note.trim() || undefined }),
      });
      if (!res.ok) throw new Error();
      toast.success(`−${active.cost * intensity} credits logged`, {
        description: "Owning it is what makes the number honest.",
      });
      setActive(null);
      onLogged();
    } catch {
      toast.error("Could not log that leak");
    } finally {
      setSaving(false);
    }
  }

  if (activeLeaks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No active leaks. Add one in the Leaks tab to start tracking what drains your savings.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
        {activeLeaks.map((leak) => (
          <button
            key={leak.id}
            onClick={() => open(leak)}
            className="glass rounded-xl p-3 text-left hover:border-red-500/30 hover:bg-red-500/5 transition-all group"
          >
            <div className="flex items-start gap-2">
              <span className="text-lg leading-none shrink-0">{leak.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{leak.name}</p>
                <p className="text-[11px] text-red-400 tabular-nums">−{leak.cost} credits</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <Dialog open={active !== null} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{active?.icon}</span>
              <span>{active?.name}</span>
            </DialogTitle>
            <DialogDescription>
              {active?.description ?? "Log this against today's balance."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                How heavy was it?
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIntensity((i) => Math.max(LEAK_INTENSITY_MIN, i - 1))}
                  disabled={intensity <= LEAK_INTENSITY_MIN}
                  aria-label="Lower intensity"
                >
                  <Minus />
                </Button>
                <div className="flex-1 text-center">
                  <p className="text-sm font-medium">{INTENSITY_LABEL[intensity]}</p>
                  <p className="text-xs text-red-400 tabular-nums">
                    −{(active?.cost ?? 0) * intensity} credits
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIntensity((i) => Math.min(LEAK_INTENSITY_MAX, i + 1))}
                  disabled={intensity >= LEAK_INTENSITY_MAX}
                  aria-label="Raise intensity"
                >
                  <Plus />
                </Button>
              </div>
            </div>

            <Input
              placeholder="What set it off? (optional, private)"
              value={note}
              maxLength={LEAK_NOTE_MAX_LEN}
              onChange={(e) => setNote(e.target.value)}
            />

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setActive(null)}>
                Cancel
              </Button>
              <Button
                className={cn("flex-1")}
                variant="destructive"
                onClick={submit}
                disabled={saving}
              >
                {saving ? "Logging..." : "Log it"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
