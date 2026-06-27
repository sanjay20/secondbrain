import type { PrismaClient } from "@prisma/client";
import type { NudgeHabit } from "@secondbrain/ai-core";
import { userDayRange } from "@/lib/datetime";

/**
 * Find active daily habits the user has missed for 2+ consecutive days.
 *
 * A habit is "broken" when it has NO completed HabitLog today AND none yesterday
 * (both calendar days, in the user's timezone). Weekly/inactive habits are
 * excluded. Uses a single half-open UTC window over the 2-day span so there is
 * no N+1 and the detection is timezone-correct (HabitLog.date is @db.Date).
 */
export async function findBrokenStreakHabits(
  prisma: PrismaClient,
  userId: string,
  today: Date,
  tz?: string | null
): Promise<NudgeHabit[]> {
  const todayRange = userDayRange(today, tz);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayRange = userDayRange(yesterday, tz);

  const habits = await prisma.habit.findMany({
    where: { userId, isActive: true, frequency: "daily" },
  });
  if (habits.length === 0) return [];

  const completedLogs = await prisma.habitLog.findMany({
    where: {
      userId,
      completed: true,
      date: { gte: yesterdayRange.gte, lt: todayRange.lt },
    },
    select: { habitId: true },
  });

  const completedHabitIds = new Set(completedLogs.map((l) => l.habitId));

  return habits
    .filter((h) => !completedHabitIds.has(h.id))
    .map((h) => ({
      name: h.name,
      category: h.category,
      icon: h.icon,
      streak: h.streak,
    }));
}
