import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Heart, Briefcase, Flame, Target, CheckCircle2, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { Header } from "@/components/layout/header";
import { StatsCard } from "@/components/dashboard/stats-card";
import { DailyBriefing } from "@/components/dashboard/daily-briefing";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

async function getDashboardData() {
  const user = await getCurrentUser();
  if (!user) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [habits, habitLogs, goals, briefing] = await Promise.all([
    prisma.habit.findMany({ where: { userId: user.id, isActive: true } }),
    prisma.habitLog.findMany({
      where: { userId: user.id, date: today, completed: true },
    }),
    prisma.goal.findMany({ where: { userId: user.id } }),
    prisma.aiBriefing.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
    }),
  ]);

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

  const { user, habits, completedTodayCount, longestStreak, activeGoalsCount, completedGoalsCount, avgProgress, briefing } = data;

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
