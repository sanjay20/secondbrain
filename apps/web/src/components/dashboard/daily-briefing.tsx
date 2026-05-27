"use client";

import { useState } from "react";
import { Sparkles, RefreshCw, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface DailyBriefingProps {
  initialBriefing?: string | null;
}

export function DailyBriefing({ initialBriefing }: DailyBriefingProps) {
  const [briefing, setBriefing] = useState<string | null>(initialBriefing ?? null);
  const [loading, setLoading] = useState(false);

  async function generateBriefing() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/briefing", { method: "POST" });
      if (!res.ok) throw new Error("Failed to generate briefing");
      const data = await res.json() as { briefing: string };
      setBriefing(data.briefing);
    } catch {
      toast.error("Couldn't generate briefing. Check your Anthropic API key.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass rounded-xl p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-400/10 flex items-center justify-center">
            <Brain className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">AI Daily Briefing</h3>
            <p className="text-xs text-muted-foreground">Personalized insights for today</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={generateBriefing}
          disabled={loading}
          className="text-muted-foreground"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {briefing ? (
        <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {briefing}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <Sparkles className="w-8 h-8 text-violet-400/50" />
          <p className="text-sm text-muted-foreground text-center">
            Your AI coach is ready to brief you on the day ahead.
          </p>
          <Button onClick={generateBriefing} disabled={loading} size="sm">
            {loading ? "Generating..." : "Generate Briefing"}
          </Button>
        </div>
      )}
    </div>
  );
}
