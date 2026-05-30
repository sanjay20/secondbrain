"use client";

import { useEffect, useState, useCallback } from "react";
import { Compass, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/header";
import { VisionCard } from "@/components/vision/vision-card";
import { VisionForm } from "@/components/vision/vision-form";
import { Button } from "@/components/ui/button";
import type { VisionArea } from "@secondbrain/types";

export default function VisionPage() {
  const [areas, setAreas] = useState<VisionArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/vision");
      setAreas((await res.json()) as VisionArea[]);
    } catch {
      toast.error("Failed to load vision areas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function getAiInsight() {
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/vision-insight", { method: "POST" });
      const data = (await res.json()) as { insight: string };
      setAiInsight(data.insight);
    } catch {
      toast.error("AI insight unavailable");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1">
      <Header title="Vision Board" subtitle="Your long-term life vision" />

      <div className="flex-1 p-6 space-y-6">
        {aiInsight && (
          <div className="glass rounded-xl p-5 border-fuchsia-500/20 bg-fuchsia-500/5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-fuchsia-400" />
              <span className="text-sm font-medium text-fuchsia-400">AI Vision Insights</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {aiInsight}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-fuchsia-400" />
            <span className="font-medium text-sm text-muted-foreground">
              {areas.length} area{areas.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={getAiInsight} disabled={aiLoading}>
              <Sparkles className="w-3.5 h-3.5" />
              {aiLoading ? "Analyzing..." : "AI Insights"}
            </Button>
            <VisionForm onSuccess={fetchData} />
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-xl bg-secondary/50 animate-pulse" />
            ))}
          </div>
        ) : areas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-fuchsia-400/10 flex items-center justify-center">
              <Compass className="w-8 h-8 text-fuchsia-400" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold">No vision areas yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Define the areas of life that matter most and write your long-term vision for each.
              </p>
            </div>
            <VisionForm onSuccess={fetchData} />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {areas.map((area) => (
              <VisionCard key={area.id} area={area} onUpdate={fetchData} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
