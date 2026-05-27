// ─── Habit types ─────────────────────────────────────────────────────────────

export interface Habit {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  icon: string;
  color: string;
  category: string;
  frequency: string;
  targetCount: number;
  isActive: boolean;
  streak: number;
  bestStreak: number;
  totalDone: number;
  createdAt: Date;
  updatedAt: Date;
  logs?: HabitLog[];
  completedToday?: boolean;
}

export interface HabitLog {
  id: string;
  habitId: string;
  userId: string;
  date: Date;
  completed: boolean;
  note?: string | null;
  createdAt: Date;
}

export type HabitFrequency = "daily" | "weekly";
export type HabitCategory = "health" | "fitness" | "mindfulness" | "learning" | "productivity" | "social" | "general";

// ─── Goal types ───────────────────────────────────────────────────────────────

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  category: string;
  status: GoalStatus;
  progress: number;
  priority: GoalPriority;
  dueDate?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  milestones?: Milestone[];
}

export interface Milestone {
  id: string;
  goalId: string;
  title: string;
  completed: boolean;
  completedAt?: Date | null;
  order: number;
  createdAt: Date;
}

export type GoalStatus = "active" | "completed" | "paused" | "abandoned";
export type GoalPriority = "low" | "medium" | "high" | "critical";
export type GoalCategory = "career" | "skill" | "project" | "education" | "personal";

// ─── Skill types ──────────────────────────────────────────────────────────────

export interface Skill {
  id: string;
  userId: string;
  name: string;
  category: string;
  level: number;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type SkillCategory = "technical" | "soft" | "language" | "tool" | "domain";

// ─── Journal types ────────────────────────────────────────────────────────────

export interface JournalEntry {
  id: string;
  userId: string;
  title?: string | null;
  content: string;
  mood?: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type MoodType = "great" | "good" | "neutral" | "bad" | "terrible";

// ─── Dashboard types ──────────────────────────────────────────────────────────

export interface DashboardStats {
  totalHabits: number;
  habitsCompletedToday: number;
  longestStreak: number;
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  avgGoalProgress: number;
}
