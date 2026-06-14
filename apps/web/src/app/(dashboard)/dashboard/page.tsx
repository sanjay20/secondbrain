import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Heart, Briefcase, Flame, Target, CheckCircle2, TrendingUp, ListTodo } from "lucide-react";
import { format, isMonday } from "date-fns";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { StatsCard } from "@/components/dashboard/stats-card";
import { DailyBriefing } from "@/components/dashboard/daily-briefing";
import { DailyAffirmation } from "@/components/dashboard/daily-affirmation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { userDayRange } from "@/lib/datetime";

async function getDashboardData() {
  const user = await getCurrentUser();
  if (!user) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayRange = userDayRange(today, user.timezone ?? undefined);

  const [habits, habitLogs, goals, briefing, todaysTasks, affirmationCount] = await Promise.all([
    prisma.habit.findMany({ where: { userId: user.id, isActive: true } }),
    prisma.habitLog.findMany({
      where: { userId: user.id, date: today, completed: true },
    }),
    prisma.goal.findMany({ where: { userId: user.id } }),
    prisma.aiBriefing.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
    }),
    prisma.task.findMany({
      where: {
        userId: user.id,
        completedAt: null,
        OR: [
          { scheduledDate: { gte: dayRange.gte, lt: dayRange.lt } },
          { rolledOver: true },
        ],
      },
      orderBy: [{ priority: "desc" }, { scheduledDate: "asc" }],
      take: 5,
    }),
    prisma.affirmation.count({ where: { userId: user.id } }),
  ]);

  const dailyAffirmation = affirmationCount
    ? (await prisma.affirmation.findMany({
        where: { userId: user.id },
        select: { id: true, text: true },
        skip: Math.floor(Math.random() * affirmationCount),
        take: 1,
      }))[0] ?? null
    : null;

  const completedTodayIds = new Set(habitLogs.map((l) => l.habitId));
  const longestStreak = habits.reduce((max, h) => Math.max(max, h.streak), 0);
  const activeGoals = goals.filter((g) => g.status === "active");
  const completedGoals = goals.filter((g) => g.status === "completed");
  const avgProgress = activeGoals.length
    ? Math.round(activeGoals.reduce((s, g) => s + g.progress, 0) / activeGoals.length)
    : 0;

  return {
    user,
    habits,
    completedTodayCount: completedTodayIds.size,
    longestStreak,
    activeGoalsCount: activeGoals.length,
    completedGoalsCount: completedGoals.length,
    avgProgress,
    briefing: briefing?.content ?? null,
    todaysTasks,
    isMonday: isMonday(new Date()),
    dailyAffirmation,
  };
}

export default async function DashboardPage() {
  const { userId: clerkId } = await auth();
  console.log("[DASHBOARD] Auth check - clerkId:", clerkId);
  if (!clerkId) {
    console.log("[DASHBOARD] No clerkId, redirecting to /sign-in");
    redirect("/sign-in");
  }

  const data = await getDashboardData();
  console.log("[DASHBOARD] Data loaded:", !!data, data?.user?.id);
  if (!data) {
    console.log("[DASHBOARD] No data, redirecting to /sign-in");
    redirect("/sign-in");
  }

  const { user, habits, completedTodayCount, longestStreak, activeGoalsCount, completedGoalsCount, avgProgress, briefing, todaysTasks, isMonday: showWeeklyReviewPrompt, dailyAffirmation } = data;

  return (
    <div className="flex flex-col flex-1">
      <Header
        title={`Good ${getGreeting()}, ${user.name?.split(" ")[0] ?? "there"} 👋`}
        subtitle={format(new Date(), "EEEE, MMMM d, yyyy")}
      />

      <div className="flex-1 p-6 space-y-6">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            title="Habits today"
            value={`${completedTodayCount}/${habits.length}`}
            subtitle={habits.length === 0 ? "No habits yet" : completedTodayCount === habits.length ? "All done! 🎉" : "Keep going!"}
            icon={Heart}
            iconColor="text-emerald-400"
          />
          <StatsCard
            title="Longest streak"
            value={`${longestStreak}d`}
            subtitle="Personal best"
            icon={Flame}
            iconColor="text-amber-400"
          />
          <StatsCard
            title="Active goals"
            value={activeGoalsCount}
            subtitle={`${completedGoalsCount} completed`}
            icon={Target}
            iconColor="text-blue-400"
          />
          <StatsCard
            title="Avg. progress"
            value={`${avgProgress}%`}
            subtitle="Across all goals"
            icon={TrendingUp}
            iconColor="text-violet-400"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <DailyBriefing initialBriefing={briefing} />
          </div>

          <div className="space-y-4">
            {/* Today's Tasks from Daily Work */}
            <div className="glass rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-cyan-400" />
                  <h3 className="font-semibold text-sm">Today&apos;s Tasks</h3>
                </div>
                <Link href="/dailywork" className="text-xs text-muted-foreground hover:text-foreground">
                  View all →
                </Link>
              </div>
              {todaysTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No tasks for today. <Link href="/dailywork" className="underline">Add one</Link>
                </p>
              ) : (
                <div className="space-y-1.5">
                  {todaysTasks.slice(0, 5).map((task) => (
                    <div key={task.id} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                      <span className="text-sm truncate">{task.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DailyAffirmation affirmation={dailyAffirmation ?? null} />

            {/* Monday weekly review prompt */}
            {showWeeklyReviewPrompt && (
              <div className="glass rounded-xl p-5 border-violet-500/20 bg-violet-500/5">
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase className="w-4 h-4 text-violet-400" />
                  <h3 className="font-semibold text-sm text-violet-400">Weekly Review</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  It&apos;s Monday — a great time to review last week and set intentions for this week.
                </p>
                <Link href="/dailywork?tab=review">
                  <button className="text-xs text-violet-400 hover:underline">Open Weekly Review →</button>
                </Link>
              </div>
            )}

            <div className="glass rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Heart className="w-4 h-4 text-emerald-400" />
                <h3 className="font-semibold text-sm">Today&apos;s Habits</h3>
              </div>
              {habits.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No habits yet. Add your first habit in Health!
                </p>
              ) : (
                <div className="space-y-2">
                  {habits.slice(0, 6).map((habit) => {
                    const done = completedTodayCount > 0;
                    return (
                      <div key={habit.id} className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${done ? "border-emerald-400 bg-emerald-400/20" : "border-border"}`}>
                          {done && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                        </div>
                        <span className="text-sm flex-1">{habit.icon} {habit.name}</span>
                        <span className="text-xs text-amber-400">🔥 {habit.streak}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="glass rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Briefcase className="w-4 h-4 text-blue-400" />
                <h3 className="font-semibold text-sm">Top Goal</h3>
              </div>
              <p className="text-sm text-muted-foreground text-center py-2">
                {activeGoalsCount === 0
                  ? "No active goals. Set one in Career!"
                  : "View your career goals for full details."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
