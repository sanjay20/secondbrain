"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { SavingsBalance, SavingsLeak, SavingsLeakLog } from "@secondbrain/types";
import { SAVINGS_WINDOW_DAYS } from "@secondbrain/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BalanceCard } from "@/components/savings/balance-card";
import { FlowChart } from "@/components/savings/flow-chart";
import { QuickLog } from "@/components/savings/quick-log";
import { LeakManager } from "@/components/savings/leak-manager";
import { BreakdownPanel } from "@/components/savings/breakdown-panel";
import { HistoryList } from "@/components/savings/history-list";
import { SavingsInsightCard } from "@/components/savings/savings-insight-card";
import { EarnRulesCard } from "@/components/savings/earn-rules-card";

const WINDOW_OPTIONS = [30, 90] as const;

export function SavingsPanel() {
  const [tab, setTab] = useState("balance");
  const [windowDays, setWindowDays] = useState<number>(SAVINGS_WINDOW_DAYS);
  const [balance, setBalance] = useState<SavingsBalance | null>(null);
  const [leaks, setLeaks] = useState<SavingsLeak[]>([]);
  const [logs, setLogs] = useState<SavingsLeakLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [balanceRes, leaksRes, logsRes] = await Promise.all([
        fetch(`/api/savings?days=${windowDays}`),
        fetch("/api/savings/leaks"),
        fetch(`/api/savings/logs?days=${windowDays}`),
      ]);
      if (!balanceRes.ok || !leaksRes.ok || !logsRes.ok) throw new Error();
      setBalance((await balanceRes.json()) as SavingsBalance);
      setLeaks((await leaksRes.json()) as SavingsLeak[]);
      setLogs((await logsRes.json()) as SavingsLeakLog[]);
    } catch {
      toast.error("Failed to load your savings");
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-40 rounded-2xl bg-secondary/50 animate-pulse" />
        <div className="h-20 rounded-xl bg-secondary/50 animate-pulse" />
        <div className="h-56 rounded-xl bg-secondary/50 animate-pulse" />
      </div>
    );
  }

  if (!balance) {
    return (
      <p className="text-sm text-muted-foreground">
        Could not load your savings. Refresh to try again.
      </p>
    );
  }

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 text-xs">
          {WINDOW_OPTIONS.map((option) => (
            <button
              key={option}
              onClick={() => setWindowDays(option)}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                windowDays === option
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {option}d
            </button>
          ))}
        </div>
        <TabsList>
          <TabsTrigger value="balance">Balance</TabsTrigger>
          <TabsTrigger value="leaks">Leaks</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="balance" className="space-y-6">
        <BalanceCard data={balance} />

        <div className="glass rounded-xl p-5 space-y-3">
          <div>
            <h2 className="font-semibold text-sm">Daily flow</h2>
            <p className="text-[11px] text-muted-foreground">
              Green in, red out, and the purple line is your running balance
            </p>
          </div>
          <FlowChart days={balance.days} />
        </div>

        <div className="glass rounded-xl p-5 space-y-3">
          <div>
            <h2 className="font-semibold text-sm">Log a leak</h2>
            <p className="text-[11px] text-muted-foreground">
              Something cost you today? Tap it — the balance only works if it is honest
            </p>
          </div>
          <QuickLog leaks={leaks} onLogged={load} />
        </div>

        <SavingsInsightCard windowDays={windowDays} />

        <BreakdownPanel data={balance} />

        <EarnRulesCard />
      </TabsContent>

      <TabsContent value="leaks">
        <LeakManager leaks={leaks} onChanged={load} />
      </TabsContent>

      <TabsContent value="history">
        <HistoryList logs={logs} onChanged={load} />
      </TabsContent>
    </Tabs>
  );
}
