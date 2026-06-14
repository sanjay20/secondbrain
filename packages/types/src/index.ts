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
  area: string;
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

export type LifeArea = "career" | "knowledge";
export type KnowledgeCategory =
  | "technical"
  | "spiritual"
  | "parenting"
  | "finance"
  | "health"
  | "personal"
  | "other";

// ─── Skill types ──────────────────────────────────────────────────────────────

export const SKILL_CATEGORIES = ["technical", "soft", "language", "tool", "domain"] as const;
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

export const SKILL_LEVELS: Record<number, string> = {
  1: "Beginner",
  2: "Basic",
  3: "Intermediate",
  4: "Advanced",
  5: "Expert",
};

export interface SkillGoal {
  id: string;
  skillId: string;
  goalId: string;
  createdAt: Date;
  goal?: { id: string; title: string };
}

export interface Skill {
  id: string;
  userId: string;
  name: string;
  area: string;
  category: string;
  level: number;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
  skillGoals?: SkillGoal[];
  goals?: { id: string; title: string }[];
}

// ─── Journal types ────────────────────────────────────────────────────────────

export interface Reminder {
  id: string;
  userId: string;
  journalEntryId: string;
  scheduledAt: Date;
  status: "pending" | "sent" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title?: string | null;
  content: string;
  category: string;
  mood?: string | null;
  tags: string[];
  reminder?: Reminder | null;
  createdAt: Date;
  updatedAt: Date;
}

export type MoodType = "great" | "good" | "neutral" | "bad" | "terrible";
export type JournalCategory =
  | "work"
  | "family"
  | "health"
  | "incident"
  | "personal"
  | "professional"
  | "spiritual"
  | "finance"
  | "other";

// ─── Wealth types ─────────────────────────────────────────────────────────────

export interface WealthAccount {
  id: string;
  userId: string;
  name: string;
  type: string;
  balancePaise: number;
  institution?: string | null;
  isLiability: boolean;
  originalPrincipalPaise?: number | null;
  interestRateBps?: number | null;
  emiPaise?: number | null;
  tenureMonths?: number | null;
  paidMonths: number;
  creditLimitPaise?: number | null;
  minimumPaymentPaise?: number | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  type: string;
  amountPaise: number;
  category: string;
  date: Date;
  note?: string | null;
  createdAt: Date;
  updatedAt: Date;
  account?: WealthAccount;
}

export interface Investment {
  id: string;
  userId: string;
  name: string;
  investmentType: string;
  units: number;
  buyPricePaise: number;
  currentPricePaise: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SavingsGoal {
  id: string;
  userId: string;
  title: string;
  targetPaise: number;
  currentPaise: number;
  targetDate?: Date | null;
  linkedAccountId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type AccountType = "bank" | "investment" | "property" | "vehicle" | "cash" | "loan" | "credit_card" | "home_loan" | "car_loan" | "personal_loan" | "education_loan" | "other";
export type LiabilityType = "loan" | "credit_card" | "home_loan" | "car_loan" | "personal_loan" | "education_loan";
export type TransactionType = "income" | "expense" | "transfer";
export type InvestmentType = "mutual_fund" | "stock" | "fd" | "ppf" | "gold" | "crypto" | "other";

export const LIABILITY_TYPES: ReadonlySet<string> = new Set<LiabilityType>(["loan", "credit_card", "home_loan", "car_loan", "personal_loan", "education_loan"]);
export const isLiabilityType = (t: string): boolean => LIABILITY_TYPES.has(t);

export const formatINR = (paise: number): string =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
    .format(paise / 100);

// ─── Daily Work types ─────────────────────────────────────────────────────────

export const PILLAR_TAGS = ["knowledge", "career", "finance", "habits"] as const;
export type PillarTag = (typeof PILLAR_TAGS)[number];

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface Task {
  id: string;
  userId: string;
  title: string;
  notes?: string | null;
  pillar?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  scheduledDate: Date;
  originalDate?: Date | null;
  rolledOver: boolean;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeBlock {
  id: string;
  userId: string;
  taskId?: string | null;
  goalId?: string | null;
  label: string;
  startTime: Date;
  endTime: Date;
  googleEventId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  task?: Task | null;
}

export interface WeeklyReview {
  id: string;
  userId: string;
  weekStart: Date;
  weekEnd: Date;
  content: WeeklyReviewContent;
  createdAt: Date;
  updatedAt: Date;
}

export interface WeeklyReviewContent {
  completedTasks: number;
  totalTasks: number;
  habitCompletionRate: number;
  notes?: string;
  highlights?: string;
  improvements?: string;
}

export interface DayPlanItem {
  title: string;
  rationale: string;
  taskId?: string;
}

export interface PlannerResult {
  items: DayPlanItem[];
  generatedAt: string;
}

// ─── Vision types ─────────────────────────────────────────────────────────────

export interface VisionArea {
  id: string;
  userId: string;
  name: string;
  statement: string;
  emoji: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

export const PILLARS = ["career", "wealth", "health", "knowledge", "relationships", "personal"] as const;
export type Pillar = (typeof PILLARS)[number];
export type FiveYearGoalStatus = "active" | "archived";
export type MonthlyGoalStatus = "todo" | "in_progress" | "done";

export interface FiveYearGoal {
  id: string;
  userId: string;
  pillar: string;
  goal: string;
  targetYear: number;
  progress: number;
  notes?: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  monthlyGoals?: MonthlyGoal[];
}

export interface MonthlyGoal {
  id: string;
  userId: string;
  fiveYearGoalId: string;
  title: string;
  month: string;
  status: string;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const BUCKET_LIST_CATEGORIES = ["travel", "experience", "achievement"] as const;
export type BucketListCategory = (typeof BUCKET_LIST_CATEGORIES)[number];

export interface BucketListItem {
  id: string;
  userId: string;
  title: string;
  category: string;
  notes?: string | null;
  completedAt?: Date | string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const MAX_CORE_VALUES = 7;

export interface CoreValue {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Mindset types ───────────────────────────────────────────────────────────

export const MOOD_LEVELS: Record<number, { emoji: string; label: string }> = {
  1: { emoji: "😞", label: "Very low" },
  2: { emoji: "😕", label: "Low" },
  3: { emoji: "😐", label: "Neutral" },
  4: { emoji: "🙂", label: "Good" },
  5: { emoji: "😄", label: "Great" },
};

export interface MoodLog {
  id: string;
  userId: string;
  date: Date | string;
  mood: number;
  note?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

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
