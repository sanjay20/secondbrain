"use client";

import { useEffect, useState, useCallback } from "react";
import { BookOpen, Target, CheckCircle2, Sparkles, Plus, Brain } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/header";
import { GoalCard } from "@/components/career/goal-card";
import { GoalForm } from "@/components/career/goal-form";
import { SkillBadge } from "@/components/career/skill-badge";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Goal, Skill } from "@secondbrain/types";

const KNOWLEDGE_CATEGORIES = [
  { value: "technical", label: "Technical", icon: "💻" },
  { value: "spiritual", label: "Spiritual", icon: "🧘" },
  { value: "parenting", label: "Parenting", icon: "👨‍👩‍👧" },
  { value: "finance", label: "Finance", icon: "💰" },
  { value: "health", label: "Health", icon: "🌱" },
  { value: "personal", label: "Personal", icon: "⭐" },
  { value: "other", label: "Other", icon: "📖" },
];

const categoryMeta = (value: string) =>
  KNOWLEDGE_CATEGORIES.find((c) => c.value === value) ?? { value, label: value, icon: "📖" };

export default function KnowledgePage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillCategory, setNewSkillCategory] = useState("technical");
  const [newSkillLevel, setNewSkillLevel] = useState("1");
  const [addingSkill, setAddingSkill] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [goalsRes, skillsRes] = await Promise.all([
        fetch("/api/goals?area=knowledge"),
        fetch("/api/skills?area=knowledge"),
      ]);
      setGoals(await goalsRes.json() as Goal[]);
      setSkills(await skillsRes.json() as Skill[]);
    } catch {
      toast.error("Failed to load knowledge data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function getRecommendations() {
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/knowledge-insight", { method: "POST" });
      const data = await res.json() as { insight: string };
      setAiInsight(data.insight);
    } catch {
      toast.error("AI recommendations unavailable");
    } finally {
      setAiLoading(false);
    }
  }

  async function addSkill() {
    if (!newSkillName.trim()) return;
    setAddingSkill(true);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSkillName.trim(),
          area: "knowledge",
          category: newSkillCategory,
          level: parseInt(newSkillLevel),
        }),
      });
      if (!res.ok) throw new Error();
      setNewSkillName("");
      setNewSkillLevel("1");
      toast.success("Added to your knowledge!");
      fetchData();
    } catch {
      toast.error("Failed to add");
    } finally {
      setAddingSkill(false);
    }
  }

  const activeGoals = goals.filter((g) => g.status === "active");
  const completedGoals = goals.filter((g) => g.status === "completed");
  const avgProgress = activeGoals.length
    ? Math.round(activeGoals.reduce((s, g) => s + g.progress, 0) / activeGoals.length)
    : 0;

  const skillsByCategory = KNOWLEDGE_CATEGORIES
    .map((c) => ({ ...c, items: skills.filter((s) => s.category === c.value) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col flex-1">
      <Header title="Knowledge" subtitle="Grow what you know — and plan what to learn next" />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard title="Learning goals" value={activeGoals.length} icon={Target} iconColor="text-pink-400" />
          <StatsCard title="Completed" value={completedGoals.length} icon={CheckCircle2} iconColor="text-emerald-400" />
          <StatsCard title="Avg. progress" value={`${avgProgress}%`} icon={BookOpen} iconColor="text-violet-400" />
          <StatsCard title="Knowledge tracked" value={skills.length} icon={Brain} iconColor="text-amber-400" />
        </div>

        {aiInsight && (
          <div className="glass rounded-xl p-5 border-pink-500/20 bg-pink-500/5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-pink-400" />
              <span className="text-sm font-medium text-pink-400">AI Knowledge Coach</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{aiInsight}</p>
          </div>
        )}

        <Tabs defaultValue="goals">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <TabsList>
              <TabsTrigger value="goals">Learning Goals ({goals.length})</TabsTrigger>
              <TabsTrigger value="knowledge">My Knowledge ({skills.length})</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={getRecommendations} disabled={aiLoading}>
                <Sparkles className="w-3.5 h-3.5" />
                {aiLoading ? "Thinking..." : "AI Recommendations"}
              </Button>
              <GoalForm
                onSuccess={fetchData}
                area="knowledge"
                categories={KNOWLEDGE_CATEGORIES}
                triggerLabel="Add Learning Goal"
                dialogTitle="New Learning Goal"
                titlePlaceholder='e.g. Read "Atomic Habits" or explore meditation'
              />
            </div>
          </div>

          <TabsContent value="goals" className="mt-4 space-y-3">
            {loading ? (
              [1, 2, 3].map((i) => <div key={i} className="h-32 rounded-xl bg-secondary/50 animate-pulse" />)
            ) : goals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-pink-400/10 flex items-center justify-center">
                  <BookOpen className="w-8 h-8 text-pink-400" />
                </div>
                <div className="text-center">
                  <h3 className="font-semibold">No learning goals yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Plan a book to read, a skill to build, or a practice to explore
                  </p>
                </div>
                <GoalForm
                  onSuccess={fetchData}
                  area="knowledge"
                  categories={KNOWLEDGE_CATEGORIES}
                  triggerLabel="Add Learning Goal"
                  dialogTitle="New Learning Goal"
                  titlePlaceholder='e.g. Read "Atomic Habits" or explore meditation'
                />
              </div>
            ) : (
              goals.map((goal) => <GoalCard key={goal.id} goal={goal} onUpdate={fetchData} />)
            )}
          </TabsContent>

          <TabsContent value="knowledge" className="mt-4">
            <div className="glass rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <Input
                  placeholder="Add knowledge (e.g. Meditation, Stoicism, Budgeting)"
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSkill()}
                  className="flex-1"
                />
                <div className="flex items-center gap-2">
                  <Select value={newSkillCategory} onValueChange={setNewSkillCategory}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {KNOWLEDGE_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={newSkillLevel} onValueChange={setNewSkillLevel}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Beginner</SelectItem>
                      <SelectItem value="2">Basic</SelectItem>
                      <SelectItem value="3">Intermediate</SelectItem>
                      <SelectItem value="4">Advanced</SelectItem>
                      <SelectItem value="5">Expert</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={addSkill} disabled={addingSkill || !newSkillName.trim()} size="sm">
                    <Plus className="w-4 h-4" />
                    Add
                  </Button>
                </div>
              </div>

              {skills.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nothing tracked yet. Add what you already know across technical, spiritual, finance, parenting and more.
                </p>
              ) : (
                <div className="space-y-5">
                  {skillsByCategory.map((group) => (
                    <div key={group.value}>
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                        {group.icon} {group.label}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {group.items.map((skill) => (
                          <SkillBadge key={skill.id} skill={skill} onDelete={fetchData} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
