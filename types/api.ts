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
  DiagnosisResultHistoryItem,
  DiagnosisSession,
  ResultSnapshotDetail,
  AiResultSummaryResponse,
  AiResultChatRequest,
  AiResultChatResponse,
  ResultRecommendedToolItem,
  ToolNavigationContext,
  AiToolExplanationResponse,
  EntryHypothesis,
  EntryIntent,
  EntryRoutingDecision,
  EntrySessionState,
  TelegramEntryReply,
  ResultRecommendedTool,
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
  activeDiagnosis: DiagnosisSession | null;
  lastCompletedDiagnosis: DiagnosisSession | null;
  latestResultSnapshot: DiagnosisResultHistoryItem | null;
  resultHistoryCount: number;
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
  resultRecommendedTools: ResultRecommendedTool[];
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

export interface ResultsHistoryResponse {
  items: DiagnosisResultHistoryItem[];
}

export interface ResultSnapshotDetailResponse {
  snapshot: ResultSnapshotDetail;
}

export interface ResultAiSummaryApiResponse extends AiResultSummaryResponse {}

export interface ResultAiChatApiRequest extends AiResultChatRequest {}

export interface ResultAiChatApiResponse extends AiResultChatResponse {}

export interface ResultToolsApiResponse {
  items: ResultRecommendedToolItem[];
}

export interface ResultToolExplainApiResponse extends AiToolExplanationResponse {}

export interface TelegramEntryRequest {
  telegramUserId: number;
  text: string;
  telegramUsername?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export interface TelegramEntryResponse {
  reply: TelegramEntryReply;
  session: EntrySessionState;
  intent: EntryIntent | null;
  hypothesis: EntryHypothesis | null;
  decision: EntryRoutingDecision;
}
