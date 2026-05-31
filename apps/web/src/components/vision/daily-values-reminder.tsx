"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { CoreValue } from "@secondbrain/types";

const STORAGE_KEY = "sb:valuesReminderSeen";

export function DailyValuesReminder() {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<CoreValue[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const today = new Date().toISOString().slice(0, 10);
    const lastSeen = localStorage.getItem(STORAGE_KEY);

    if (lastSeen === today) return;

    fetch("/api/vision/values")
      .then((res) => res.json())
      .then((data: CoreValue[]) => {
        localStorage.setItem(STORAGE_KEY, today);
        if (data.length > 0) {
          setValues(data);
          setOpen(true);
        }
      })
      .catch(() => {
        // silently fail — reminder is non-critical
      });
  }, []);

  function handleClose() {
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-violet-400" />
            Your Core Values
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-4">
          Keep these in mind as you move through your day.
        </p>
        <ul className="space-y-3">
          {values.map((v) => (
            <li key={v.id} className="glass rounded-lg p-3 border-l-4" style={{ borderColor: "#8b5cf6" }}>
              <p className="font-semibold text-sm">{v.name}</p>
              {v.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{v.description}</p>
              )}
            </li>
          ))}
        </ul>
        <Button className="w-full mt-4" onClick={handleClose}>
          Got it
        </Button>
      </DialogContent>
    </Dialog>
  );
}
