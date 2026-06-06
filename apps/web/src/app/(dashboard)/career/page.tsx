"use client";

import { useEffect, useState, useCallback } from "react";
import { Briefcase, Target, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/header";
import { GoalCard } from "@/components/career/goal-card";
import { GoalForm } from "@/components/career/goal-form";
import { SkillCard } from "@/components/career/skill-card";
import { SkillForm } from "@/components/career/skill-form";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SKILL_CATEGORIES } from "@secondbrain/types";
import type { Goal, Skill } from "@secondbrain/types";

const categoryLabels: Record<string, string> = {
  technical: "Technical",
  soft: "Soft Skills",
  language: "Languages",
  tool: "Tools",
  domain: "Domain",
};

export default function CareerPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [goalsRes, skillsRes] = await Promise.all([
        fetch("/api/goals?area=career"),
        fetch("/api/skills?area=career"),
      ]);
      setGoals(await goalsRes.json() as Goal[]);
      setSkills(await skillsRes.json() as Skill[]);
    } catch {
      toast.error("Failed to load career data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function getAiInsight() {
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/career-insight", { method: "POST" });
      const data = await res.json() as { insight: string };
      setAiInsight(data.insight);
    } catch {
      toast.error("AI insight unavailable");
    } finally {
      setAiLoading(false);
    }
  }

  const activeGoals = goals.filter((g) => g.status === "active");
  const completedGoals = goals.filter((g) => g.status === "completed");
  const avgProgress = activeGoals.length
    ? Math.round(activeGoals.reduce((s, g) => s + g.progress, 0) / activeGoals.length)
    : 0;

  const goalOptions = goals.map((g) => ({ id: g.id, title: g.title }));

  const skillsByCategory = SKILL_CATEGORIES.reduce<Record<string, Skill[]>>((acc, cat) => {
    const group = skills.filter((s) => s.category === cat);
    if (group.length > 0) acc[cat] = group;
    return acc;
  }, {});
  const uncategorized = skills.filter((s) => !SKILL_CATEGORIES.includes(s.category as typeof SKILL_CATEGORIES[number]));

  return (
    <div className="flex flex-col flex-1">
      <Header title="Career Building" subtitle="Grow your career with clarity and purpose" />

      <div className="flex-1 p-6 space-y-6">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard title="Active goals" value={activeGoals.length} icon={Target} iconColor="text-blue-400" />
          <StatsCard title="Completed" value={completedGoals.length} icon={CheckCircle2} iconColor="text-emerald-400" />
          <StatsCard title="Avg. progress" value={`${avgProgress}%`} icon={Briefcase} iconColor="text-violet-400" />
          <StatsCard title="Skills tracked" value={skills.length} icon={Sparkles} iconColor="text-amber-400" />
        </div>

        {aiInsight && (
          <div className="glass rounded-xl p-5 border-blue-500/20 bg-blue-500/5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-400">AI Career Coach</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{aiInsight}</p>
          </div>
        )}

        <Tabs defaultValue="goals">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="goals">Goals ({goals.length})</TabsTrigger>
              <TabsTrigger value="skills">Skills ({skills.length})</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={getAiInsight} disabled={aiLoading}>
                <Sparkles className="w-3.5 h-3.5" />
                {aiLoading ? "Analyzing..." : "AI Insights"}
              </Button>
              <GoalForm onSuccess={fetchData} />
            </div>
          </div>

          <TabsContent value="goals" className="mt-4 space-y-3">
            {loading ? (
              [1, 2, 3].map((i) => <div key={i} className="h-32 rounded-xl bg-secondary/50 animate-pulse" />)
            ) : goals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-blue-400/10 flex items-center justify-center">
                  <Target className="w-8 h-8 text-blue-400" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold">No goals yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">Define what you want to achieve in your career</p>
                </div>
                <GoalForm onSuccess={fetchData} />
              </div>
            ) : (
              goals.map((goal) => <GoalCard key={goal.id} goal={goal} onUpdate={fetchData} />)
            )}
          </TabsContent>

          <TabsContent value="skills" className="mt-4 space-y-6">
            <div className="glass rounded-xl p-5">
              <SkillForm onSuccess={fetchData} />
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-secondary/50 animate-pulse" />)}
              </div>
            ) : skills.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-amber-400/10 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-amber-400" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold">No skills tracked yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">Add your first skill above to start tracking your growth</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {SKILL_CATEGORIES.filter((cat) => skillsByCategory[cat]).map((cat) => (
                  <div key={cat}>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                      {categoryLabels[cat] ?? cat}
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {skillsByCategory[cat].map((skill) => (
                        <SkillCard key={skill.id} skill={skill} goals={goalOptions} onUpdate={fetchData} />
                      ))}
                    </div>
                  </div>
                ))}
                {uncategorized.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                      Other
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {uncategorized.map((skill) => (
                        <SkillCard key={skill.id} skill={skill} goals={goalOptions} onUpdate={fetchData} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
