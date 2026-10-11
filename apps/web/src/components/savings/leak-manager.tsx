"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import type { SavingsLeak } from "@secondbrain/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LeakForm } from "@/components/savings/leak-form";
import { getPillarMeta } from "@/lib/pillars";
import { cn } from "@/lib/utils";

interface LeakManagerProps {
  leaks: SavingsLeak[];
  onChanged: () => void;
}

export function LeakManager({ leaks, onChanged }: LeakManagerProps) {
  const [editing, setEditing] = useState<SavingsLeak | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(leak: SavingsLeak) {
    setEditing(leak);
    setFormOpen(true);
  }

  async function toggleActive(leak: SavingsLeak) {
    setBusyId(leak.id);
    try {
      const res = await fetch(`/api/savings/leaks/${leak.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !leak.isActive }),
      });
      if (!res.ok) throw new Error();
      onChanged();
    } catch {
      toast.error("Could not update that leak");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(leak: SavingsLeak) {
    if (
      !confirm(
        `Delete "${leak.name}"? Every occurrence you logged against it is deleted too, and your balance is recalculated without them.`
      )
    ) {
      return;
    }
    setBusyId(leak.id);
    try {
      const res = await fetch(`/api/savings/leaks/${leak.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Leak deleted");
      onChanged();
    } catch {
      toast.error("Could not delete that leak");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          These are yours to shape — rename them, re-price them, or add what is actually costing you.
        </p>
        <Button size="sm" onClick={openNew} className="shrink-0">
          <Plus /> Add leak
        </Button>
      </div>

      <div className="space-y-2">
        {leaks.map((leak) => {
          const pillar = getPillarMeta(leak.pillar);
          return (
            <div
              key={leak.id}
              className={cn(
                "glass rounded-xl p-3 flex items-center gap-3",
                !leak.isActive && "opacity-50"
              )}
            >
              <span className="text-xl shrink-0">{leak.icon}</span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium truncate">{leak.name}</p>
                  <Badge variant="outline" className={cn("text-[10px]", pillar.color)}>
                    {pillar.label}
                  </Badge>
                  {!leak.isActive && (
                    <Badge variant="secondary" className="text-[10px]">
                      Paused
                    </Badge>
                  )}
                </div>
                {leak.description && (
                  <p className="text-[11px] text-muted-foreground truncate">{leak.description}</p>
                )}
              </div>

              <span className="text-sm font-semibold text-red-400 tabular-nums shrink-0">
                −{leak.cost}
              </span>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleActive(leak)}
                  disabled={busyId === leak.id}
                  aria-label={leak.isActive ? "Pause leak" : "Resume leak"}
                  title={leak.isActive ? "Pause — hides it from quick log" : "Resume"}
                >
                  <Power className={leak.isActive ? "text-emerald-400" : "text-muted-foreground"} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEdit(leak)}
                  aria-label="Edit leak"
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(leak)}
                  disabled={busyId === leak.id}
                  aria-label="Delete leak"
                >
                  <Trash2 className="text-red-400" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <LeakForm
        leak={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={onChanged}
      />
    </div>
  );
}
