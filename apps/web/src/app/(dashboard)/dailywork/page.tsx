"use client";

import { useEffect, useState, useCallback } from "react";
import { format, startOfWeek, addDays } from "date-fns";
import { toast } from "sonner";
import { CalendarDays, Clock, ClipboardList, BarChart3, Sparkles } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { TaskCard } from "@/components/dailywork/task-card";
import { TaskForm } from "@/components/dailywork/task-form";
import { Timeline } from "@/components/dailywork/timeline";
import { DayPlanCard } from "@/components/dailywork/day-plan-card";
import type { Task, TimeBlock, WeeklyReview, PlannerResult, DayPlanItem } from "@secondbrain/types";

type GcalEvent = { summary: string; start: string; end: string };

export default function DailyWorkPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [review, setReview] = useState<{ weekStart: string; weekEnd: string; content: WeeklyReview["content"]; saved: boolean } | null>(null);
  const [dayPlan, setDayPlan] = useState<PlannerResult | null>(null);
  const [gcalEvents, setGcalEvents] = useState<GcalEvent[]>([]);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [taskView, setTaskView] = useState<"today" | "upcoming" | "completed">("today");

  // Time block form
  const [blockLabel, setBlockLabel] = useState("");
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [addingBlock, setAddingBlock] = useState(false);

  // Review form
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewHighlights, setReviewHighlights] = useState("");
  const [reviewImprovements, setReviewImprovements] = useState("");
  const [savingReview, setSavingReview] = useState(false);

  const today = format(new Date(), "yyyy-MM-dd");
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/dailywork/tasks?view=${taskView}`);
      const data = await res.json() as Task[];
      setTasks(data);
    } catch {
      toast.error("Failed to load tasks");
    }
  }, [taskView]);

  const fetchTimeBlocks = useCallback(async () => {
    try {
      const res = await fetch(`/api/dailywork/timeblocks?date=${today}`);
      const data = await res.json() as TimeBlock[];
      setTimeBlocks(data);
    } catch {
      toast.error("Failed to load time blocks");
    }
  }, [today]);

  const fetchReview = useCallback(async () => {
    try {
      const res = await fetch(`/api/dailywork/reviews/current?weekStart=${weekStart}`);
      const data = await res.json() as typeof review;
      setReview(data);
      if (data) {
        setReviewNotes((data.content as { notes?: string }).notes ?? "");
        setReviewHighlights((data.content as { highlights?: string }).highlights ?? "");
        setReviewImprovements((data.content as { improvements?: string }).improvements ?? "");
      }
    } catch {
      toast.error("Failed to load weekly review");
    }
  }, [weekStart]);

  useEffect(() => {
    Promise.all([fetchTasks(), fetchTimeBlocks(), fetchReview()]).finally(() =>
      setLoading(false)
    );
    // Check for Google Calendar connection status from URL
    const params = new URLSearchParams(window.location.search);
    if (params.get("calendar") === "connected") {
      setCalendarConnected(true);
      toast.success("Google Calendar connected!");
    } else if (params.get("calendar") === "error") {
      toast.error("Failed to connect Google Calendar");
    }
  }, [fetchTasks, fetchTimeBlocks, fetchReview]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  async function addTask(data: { title: string; pillar?: string; priority: string; scheduledDate: string; notes?: string }) {
    const res = await fetch("/api/dailywork/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json() as { error?: string };
      toast.error(err.error ?? "Failed to add task");
      return;
    }
    toast.success("Task added");
    fetchTasks();
  }

  async function toggleTask(id: string, done: boolean) {
    // Optimistic update
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: done ? "done" : "todo" } : t));
    const res = await fetch(`/api/dailywork/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: done ? "done" : "todo" }),
    });
    if (!res.ok) {
      setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: done ? "todo" : "done" } : t));
      toast.error("Failed to update task");
    } else {
      toast.success(done ? "Task completed!" : "Task reopened");
    }
  }

  async function deleteTask(id: string) {
    const res = await fetch(`/api/dailywork/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed to delete task"); return; }
    toast.success("Task removed");
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  async function addTimeBlock() {
    if (!blockLabel.trim() || !blockStart || !blockEnd) return;
    setAddingBlock(true);
    try {
      const start = new Date(`${today}T${blockStart}:00`).toISOString();
      const end = new Date(`${today}T${blockEnd}:00`).toISOString();
      const res = await fetch("/api/dailywork/timeblocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: blockLabel.trim(), startTime: start, endTime: end }),
      });
      const data = await res.json() as TimeBlock & { conflict?: boolean };
      if (!res.ok) { toast.error((data as unknown as { error?: string }).error ?? "Failed to add block"); return; }
      if (data.conflict) toast.warning("Time conflict with existing block — saved anyway.");
      else toast.success("Time block added");
      setBlockLabel(""); setBlockStart(""); setBlockEnd("");
      fetchTimeBlocks();
    } finally {
      setAddingBlock(false);
    }
  }

  async function deleteTimeBlock(id: string) {
    const res = await fetch(`/api/dailywork/timeblocks/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed to remove block"); return; }
    toast.success("Block removed");
    setTimeBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  async function refreshGcal() {
    try {
      const res = await fetch("/api/integrations/google/sync", { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json() as { events: GcalEvent[] };
      setGcalEvents(data.events);
      toast.success(`Synced ${data.events.length} event(s) from Google Calendar`);
    } catch {
      toast.error("Failed to sync Google Calendar");
    }
  }

  async function fetchDayPlan() {
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/dayplan-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "plan" }),
      });
      const data = await res.json() as PlannerResult;
      setDayPlan(data);
    } catch {
      toast.error("AI plan unavailable");
    } finally {
      setAiLoading(false);
    }
  }

  function scheduleFromPlan(item: DayPlanItem) {
    setBlockLabel(item.title);
    toast.info(`Fill in a start/end time to schedule "${item.title}"`);
  }

  async function saveReview() {
    if (!review) return;
    setSavingReview(true);
    try {
      const res = await fetch("/api/dailywork/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart: review.weekStart,
          content: {
            ...review.content,
            notes: reviewNotes,
            highlights: reviewHighlights,
            improvements: reviewImprovements,
          },
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Review saved");
      fetchReview();
    } catch {
      toast.error("Failed to save review");
    } finally {
      setSavingReview(false);
    }
  }

  const pendingTasks = tasks.filter((t) => t.status !== "done");
  const completedTasks = tasks.filter((t) => t.status === "done");

  if (loading) {
    return (
      <div className="flex flex-col flex-1">
        <Header title="Daily Work" subtitle="Tasks, time blocking & weekly reviews" />
        <div className="flex-1 p-4 md:p-6 space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-secondary/50 animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      <Header title="Daily Work" subtitle={`${format(new Date(), "EEEE, MMMM d")} — Stay focused, make progress`} />

      <div className="flex-1 p-4 md:p-6 space-y-6">
        <Tabs defaultValue="today">
          <TabsList className="mb-2">
            <TabsTrigger value="today">
              <CalendarDays className="w-3.5 h-3.5 mr-1" />
              Today
            </TabsTrigger>
            <TabsTrigger value="tasks">
              <ClipboardList className="w-3.5 h-3.5 mr-1" />
              Tasks
            </TabsTrigger>
            <TabsTrigger value="review">
              <BarChart3 className="w-3.5 h-3.5 mr-1" />
              Weekly Review
            </TabsTrigger>
          </TabsList>

          {/* ── TODAY ─────────────────────────────────────────────────────── */}
          <TabsContent value="today" className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Left: Tasks */}
              <div className="space-y-4">
                <div className="glass rounded-xl p-5 space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-violet-400" />
                    Today&apos;s Tasks
                    <span className="text-muted-foreground font-normal">({pendingTasks.length} pending)</span>
                  </h3>

                  <TaskForm onSubmit={addTask} defaultDate={today} />

                  <div className="space-y-2 mt-2">
                    {pendingTasks.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No tasks for today. Add one above or they&apos;ll roll over from yesterday.
                      </p>
                    )}
                    {pendingTasks.map((task) => (
                      <TaskCard key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />
                    ))}
                    {completedTasks.length > 0 && (
                      <div className="pt-2 border-t border-border">
                        <p className="text-[11px] text-muted-foreground mb-1">{completedTasks.length} completed</p>
                        {completedTasks.slice(0, 3).map((task) => (
                          <TaskCard key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Timeline + AI Plan */}
              <div className="space-y-4">
                {/* AI Day Plan */}
                <DayPlanCard
                  plan={dayPlan}
                  loading={aiLoading}
                  onRefresh={fetchDayPlan}
                  onSchedule={scheduleFromPlan}
                />

                {/* Timeline */}
                <div className="glass rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-400" />
                      Time Blocks
                    </h3>
                    {calendarConnected && (
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={refreshGcal}>
                        Sync GCal
                      </Button>
                    )}
                    {!calendarConnected && (
                      <a
                        href="/api/integrations/google/connect"
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                      >
                        Connect Google Calendar
                      </a>
                    )}
                  </div>

                  <Timeline
                    blocks={timeBlocks}
                    gcalEvents={gcalEvents}
                    onDeleteBlock={deleteTimeBlock}
                  />

                  {/* Add time block form */}
                  <div className="pt-2 border-t border-border">
                    <div className="flex gap-2 flex-wrap">
                      <Input
                        placeholder="Label"
                        value={blockLabel}
                        onChange={(e) => setBlockLabel(e.target.value)}
                        className="flex-1 min-w-32"
                      />
                      <Input
                        type="time"
                        value={blockStart}
                        onChange={(e) => setBlockStart(e.target.value)}
                        className="w-28"
                      />
                      <Input
                        type="time"
                        value={blockEnd}
                        onChange={(e) => setBlockEnd(e.target.value)}
                        className="w-28"
                      />
                      <Button
                        size="sm"
                        onClick={addTimeBlock}
                        disabled={addingBlock || !blockLabel.trim() || !blockStart || !blockEnd}
                      >
                        Add Block
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── TASKS ─────────────────────────────────────────────────────── */}
          <TabsContent value="tasks" className="space-y-4">
            <div className="glass rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold">Add Task</h3>
              <TaskForm onSubmit={addTask} />
            </div>

            {/* View selector */}
            <div className="flex gap-2">
              {(["today", "upcoming", "completed"] as const).map((v) => (
                <Button
                  key={v}
                  variant={taskView === v ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTaskView(v)}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </Button>
              ))}
            </div>

            <div className="space-y-2">
              {tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <ClipboardList className="w-8 h-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No tasks in this view.</p>
                </div>
              ) : (
                tasks.map((task) => (
                  <TaskCard key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />
                ))
              )}
            </div>
          </TabsContent>

          {/* ── WEEKLY REVIEW ─────────────────────────────────────────────── */}
          <TabsContent value="review" className="space-y-6">
            {review && (
              <>
                <div className="glass rounded-xl p-5 space-y-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-violet-400" />
                    Week of {format(new Date(review.weekStart), "MMM d")} –{" "}
                    {format(addDays(new Date(review.weekStart), 6), "MMM d, yyyy")}
                    {review.saved && (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded">Saved</span>
                    )}
                  </h3>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-violet-400">
                        {(review.content as { completedTasks?: number }).completedTasks ?? 0}/
                        {(review.content as { totalTasks?: number }).totalTasks ?? 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Tasks done</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-emerald-400">
                        {(review.content as { habitCompletionRate?: number }).habitCompletionRate ?? 0}%
                      </p>
                      <p className="text-xs text-muted-foreground">Habit rate</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-400">
                        <Sparkles className="w-5 h-5 inline" />
                      </p>
                      <p className="text-xs text-muted-foreground">AI Insight</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Highlights</label>
                      <Textarea
                        placeholder="What went well this week?"
                        value={reviewHighlights}
                        onChange={(e) => setReviewHighlights(e.target.value)}
                        className="text-sm min-h-20 resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Improvements</label>
                      <Textarea
                        placeholder="What could be better next week?"
                        value={reviewImprovements}
                        onChange={(e) => setReviewImprovements(e.target.value)}
                        className="text-sm min-h-20 resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
                      <Textarea
                        placeholder="Any other reflections…"
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        className="text-sm min-h-16 resize-none"
                      />
                    </div>
                    <Button size="sm" onClick={saveReview} disabled={savingReview}>
                      {savingReview ? "Saving…" : "Save Review"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
