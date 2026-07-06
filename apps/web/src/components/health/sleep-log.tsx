"use client";

import { useEffect, useState, useCallback } from "react";
import { Moon } from "lucide-react";
import { toast } from "sonner";
import { SleepCard } from "@/components/health/sleep-card";
import { SleepForm } from "@/components/health/sleep-form";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Button } from "@/components/ui/button";
import { formatDuration, type SleepLog } from "@secondbrain/types";

interface SleepResponse {
  sleepLogs: SleepLog[];
  total: number;
  weeklyAverageMinutes: number;
  weeklyCount: number;
}

export function SleepLog() {
  const [logs, setLogs] = useState<SleepLog[]>([]);
  const [total, setTotal] = useState(0);
  const [weeklyAverageMinutes, setWeeklyAverageMinutes] = useState(0);
  const [weeklyCount, setWeeklyCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [editing, setEditing] = useState<SleepLog | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/sleep-logs");
      const data = (await res.json()) as SleepResponse;
      setLogs(data.sleepLogs);
      setTotal(data.total);
      setWeeklyAverageMinutes(data.weeklyAverageMinutes);
      setWeeklyCount(data.weeklyCount);
    } catch {
      toast.error("Failed to load sleep logs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/sleep-logs?skip=${logs.length}`);
      const data = (await res.json()) as SleepResponse;
      setLogs((prev) => [...prev, ...data.sleepLogs]);
      setTotal(data.total);
    } catch {
      toast.error("Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg">Sleep</h2>
        <SleepForm onSuccess={refresh} />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          title="Weekly average"
          value={formatDuration(weeklyAverageMinutes)}
          subtitle={weeklyCount < 7 ? `Based on ${weeklyCount} night${weeklyCount === 1 ? "" : "s"}` : undefined}
          icon={Moon}
          iconColor="text-indigo-400"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-secondary/50 animate-pulse" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-400/10 flex items-center justify-center">
            <Moon className="w-8 h-8 text-indigo-400" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold">No sleep logged yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Track your first night of sleep</p>
          </div>
          <SleepForm onSuccess={refresh} />
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <SleepCard key={log.id} sleepLog={log} onUpdate={refresh} onEdit={setEditing} />
          ))}
          {logs.length < total && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading..." : "Load more"}
              </Button>
            </div>
          )}
        </div>
      )}

      {editing && (
        <SleepForm
          editLog={editing}
          open={!!editing}
          onOpenChange={(o) => { if (!o) setEditing(null); }}
          onSuccess={() => { setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
}
