export type UUID = string;

export type DiagnosisDimension =
  | "sales"
  | "marketing"
  | "finance"
  | "operations"
  | "team"
  | "product";

export type DiagnosisSessionStatus = "in_progress" | "completed";

export type ToolFormat = "checklist" | "template" | "guide" | "calculator";

export type BusinessStage = "early" | "growth";

export interface User {
  id: UUID;
  telegramUserId: number;
  telegramUsername: string | null;
  firstName: string;
  lastName: string | null;
  languageCode: string | null;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: UUID;
  userId: UUID;
  name: string;
  industry: string;
  teamSize: string;
  revenueRange: string | null;
  description: string | null;
  primaryGoal: string | null;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DiagnosisQuestionSet {
  id: UUID;
  code: string;
  title: string;
  description: string | null;
  version: number;
  isActive: boolean;
  createdAt: string;
}

export interface DiagnosisQuestionOption {
  value: number;
  label: string;
}

export interface DiagnosisQuestion {
  id: UUID;
  questionSetId: UUID;
  code: string;
  title: string | null;
  questionText: string;
  dimension: DiagnosisDimension;
  position: number | null;
  orderIndex: number;
  inputType: "scale" | "single_select";
  isRequired: boolean;
  options: DiagnosisQuestionOption[];
  weight: number;
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface DiagnosisSession {
  id: UUID;
  companyId: UUID;
  questionSetId: UUID;
  status: DiagnosisSessionStatus;
  totalScore: number | null;
  summaryKey: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface DiagnosisAnswer {
  id: UUID;
  diagnosisSessionId: UUID;
  questionId: UUID;
  answerValue: number;
  answerLabel: string | null;
  createdAt: string;
}

export interface DiagnosisAnswerInput {
  questionId: UUID;
  answerValue: number;
  answerLabel?: string | null;
}

export interface DiagnosisDimensionScore {
  dimension: string;
  averageScore: number;
}

export interface DiagnosisResultSummary {
  key: "low" | "medium" | "high";
  title: string;
  description: string;
  strengths: string[];
  risks: string[];
}

export interface ToolCategory {
  id: UUID;
  slug: string;
  name: string;
  description: string | null;
  position: number;
  createdAt: string;
}

export interface ToolContent {
  [key: string]: unknown;
}

export interface Tool {
  id: UUID;
  categoryId: UUID;
  slug: string;
  title: string;
  summary: string;
  problem: string | null;
  format: ToolFormat;
  stage: BusinessStage | null;
  estimatedMinutes: number | null;
  isFeatured: boolean;
  content: ToolContent;
  createdAt: string;
}

export interface RecommendedTool {
  id: UUID;
  slug: string;
  title: string;
  summary: string;
  whyRecommended: string;
  externalUrl: string;
}

export interface DiagnosisSummaryContext {
  weakestDomains: string[];
  strongestDomains: string[];
  topProblems: string[];
  recommendedTools: Array<{
    title: string;
    whyRecommended: string;
  }>;
  company: {
    id: UUID;
    name: string;
    industry: string;
    teamSize: string;
    revenueRange: string | null;
    primaryGoal: string | null;
  } | null;
}

export interface DiagnosisAiSummary {
  mainSummary: string;
  mainFocus: string;
  whyNow: string[];
  strengths: string[];
  firstSteps: string[];
}

export interface DiagnosisChatContext {
  company: {
    name: string | null;
    industry: string | null;
    teamSize: string | null;
    revenue: string | null;
    goal: string | null;
  } | null;
  scores: {
    owner: number | null;
    market: number | null;
    strategy: number | null;
    product: number | null;
    sales: number | null;
    operations: number | null;
    finance: number | null;
    team: number | null;
    management: number | null;
    tech: number | null;
    data: number | null;
  };
  summary: {
    main_summary: string;
    main_focus: string;
    why_now: string[];
    strengths: string[];
    first_steps: string[];
  };
}

export interface DiagnosisChatReply {
  reply: string;
}
