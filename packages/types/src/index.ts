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

export const WORKOUT_TYPE_MAX_LEN = 50;
export const WORKOUT_NOTES_MAX_LEN = 500;
export const WORKOUT_PAGE_LIMIT = 50;

export interface Workout {
  id: string;
  userId: string;
  type: string;
  duration: number;
  notes?: string | null;
  date: Date | string;
  createdAt: Date | string;
}

export const SLEEP_NOTE_MAX_LEN = 500;
export const SLEEP_PAGE_LIMIT = 20;
export const SLEEP_QUALITY_MIN = 1;
export const SLEEP_QUALITY_MAX = 5;

export interface SleepLog {
  id: string;
  userId: string;
  startTime: Date | string;
  endTime: Date | string;
  quality?: number | null;
  note?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export function sleepDurationMinutes(start: Date | string, end: Date | string): number {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}

export function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
}

// ─── Nutrition types ───────────────────────────────────────────────────────────

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];
export const MEAL_NAME_MAX_LEN = 200;
export const MEAL_CALORIES_MAX = 20000;
export const MEAL_MACRO_MAX = 2000;
export const MEAL_PAGE_LIMIT = 100;

export interface MealEntry {
  id: string;
  userId: string;
  name: string;
  mealType: string;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  date: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface MealTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function mealTotals(meals: MealEntry[]): MealTotals {
  return meals.reduce<MealTotals>(
    (acc, m) => ({
      calories: acc.calories + (m.calories ?? 0),
      protein: acc.protein + (m.protein ?? 0),
      carbs: acc.carbs + (m.carbs ?? 0),
      fat: acc.fat + (m.fat ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
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

export const GRATITUDE_MAX_PER_DAY = 3;
export const GRATITUDE_ITEM_MAX_LEN = 280;

export interface GratitudeEntry {
  id: string;
  userId: string;
  item: string;
  date: Date | string;
  createdAt: Date | string;
}

export const AFFIRMATION_TEXT_MIN_LEN = 1;
export const AFFIRMATION_TEXT_MAX_LEN = 200;

export interface Affirmation {
  id: string;
  userId: string;
  text: string;
  createdAt: Date | string;
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

// ─── Note types ────────────────────────────────────────────────────────────────

export const NOTE_PILLARS = ["health", "career", "wealth", "knowledge"] as const;
export type NotePillar = (typeof NOTE_PILLARS)[number];
export const NOTE_CONTENT_MAX_LEN = 2000;
export const NOTE_PAGE_LIMIT = 100;

export interface Note {
  id: string;
  userId: string;
  content: string;
  pillar: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ─── Highlight types ─────────────────────────────────────────────────────────

export const HIGHLIGHT_TEXT_MAX_LEN = 2000;
export const READING_TYPES = ["book", "article"] as const;
export type ReadingType = (typeof READING_TYPES)[number];

export interface ReadingItem {
  id: string;
  userId: string;
  title: string;
  author?: string | null;
  type: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Highlight {
  id: string;
  userId: string;
  readingItemId: string;
  text: string;
  createdAt: Date | string;
  readingItem?: Pick<ReadingItem, "id" | "title" | "author" | "type">;
}

export interface HighlightRecap {
  count: number;
  weekStart: Date | string;
  items: Array<{
    id: string;
    text: string;
    sourceTitle: string;
    sourceAuthor?: string | null;
    createdAt: Date | string;
  }>;
}

// ─── Contact types ───────────────────────────────────────────────────────────

export const CONTACT_NAME_MAX_LEN = 120;
export const CONTACT_NOTES_MAX_LEN = 2000;
export const CONTACT_PAGE_LIMIT = 200;
export const RELATIONSHIP_TYPES = ["family", "friend", "colleague", "mentor", "other"] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export interface Contact {
  id: string;
  userId: string;
  name: string;
  relationshipType: string;
  notes?: string | null;
  lastInteractionAt: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}
