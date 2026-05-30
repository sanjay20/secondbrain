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
}

export type SkillCategory = "technical" | "soft" | "language" | "tool" | "domain";

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
