import type {
  DiagnosisAnswerInput,
  DiagnosisDimensionScore,
  DiagnosisChatContext,
  DiagnosisChatMode,
  DiagnosisChatReply,
  Company,
  DiagnosisQuestion,
  DiagnosisQuestionSet,
  DiagnosisResultSummary,
  DiagnosisAiSummary,
  DiagnosisSummaryContext,
  DiagnosisSession,
  RecommendedTool,
  Tool,
  ToolCategory,
  User,
} from "./domain";

export interface AuthResponse {
  user: User;
  company: Company | null;
}

export interface CompanyUpsertRequest {
  name: string;
  industry: string;
  teamSize: string;
  revenueRange?: string;
  description?: string;
  primaryGoal?: string;
  onboardingCompleted?: boolean;
}

export interface DashboardResponse {
  user: User;
  company: Company | null;
  latestDiagnosis: DiagnosisSession | null;
  featuredTools: Tool[];
}

export interface DiagnosisStartGetResponse {
  questionSet: DiagnosisQuestionSet;
  questions: DiagnosisQuestion[];
}

export interface DiagnosisStartRequest {
  companyId?: string;
  questionSetCode?: string;
}

export interface DiagnosisStartResponse {
  session: DiagnosisSession;
  questionSet: DiagnosisQuestionSet;
  questions: DiagnosisQuestion[];
}

export interface DiagnosisSubmitRequest {
  sessionId: string;
  answers: Array<{
    questionId: string;
    value: number;
  }>;
}

export interface DiagnosisSubmitResponse {
  session: DiagnosisSession;
  totalScore: number;
  answeredCount: number;
  summaryKey: DiagnosisResultSummary["key"];
}

export interface DiagnosisResultResponse {
  questionSet: DiagnosisQuestionSet;
  questions: DiagnosisQuestion[];
  session: DiagnosisSession;
  answers: DiagnosisAnswerInput[];
  dimensionScores: DiagnosisDimensionScore[];
  summary: DiagnosisResultSummary;
  tools: RecommendedTool[];
  summaryContext: DiagnosisSummaryContext;
  aiSummary: DiagnosisAiSummary | null;
}

export interface DiagnosisChatRequest {
  sessionId: string;
  message: string;
  mode?: DiagnosisChatMode;
  step?: number;
  selectedPath?: string;
}

export interface DiagnosisChatResponse extends DiagnosisChatReply {
  context: DiagnosisChatContext;
}

export interface ToolsLibraryResponse {
  categories: ToolCategory[];
  tools: Tool[];
}
