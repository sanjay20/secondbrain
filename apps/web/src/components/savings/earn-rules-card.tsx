"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { EARN_RULE_KEYS, EARN_RULES } from "@/lib/life-savings";
import { cn } from "@/lib/utils";

/**
 * The rules, in the open. A score the user cannot see the workings of is a
 * score they will not trust — and these are exactly the actions the module is
 * trying to get them to repeat.
 */
export function EarnRulesCard() {
  const [open, setOpen] = useState(false);

  return (
    <div className="glass rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full p-5 flex items-center justify-between gap-3 text-left"
      >
        <div>
          <h2 className="font-semibold text-sm">How you earn credits</h2>
          <p className="text-[11px] text-muted-foreground">
            Pulled automatically from your habits, tasks, sleep and reflection — nothing extra to log
          </p>
        </div>
        <ChevronDown
          className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-2">
          {EARN_RULE_KEYS.map((key) => {
            const rule = EARN_RULES[key];
            return (
              <div key={key} className="flex items-center gap-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate">{rule.label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{rule.description}</p>
                </div>
                <span className="text-emerald-400 font-semibold tabular-nums shrink-0">
                  +{rule.credits}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
