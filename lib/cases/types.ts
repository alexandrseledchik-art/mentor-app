import type { DiagnosticStructuredResult } from "@/lib/diagnostic-core/schema";

export type CaseSource = "telegram" | "mini_app" | "manual";
export type CaseStatus = "draft" | "clarifying" | "completed" | "archived";
export type CaseMessageRole = "user" | "assistant" | "system";

export interface BusinessCase {
  id: string;
  userId: string;
  companyId: string | null;
  workspaceId: string | null;
  source: CaseSource;
  status: CaseStatus;
  initialMessage: string;
  currentStage: string;
  turnCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface CaseMessage {
  id: string;
  caseId: string;
  role: CaseMessageRole;
  text: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CaseCompletionRecord {
  case: BusinessCase;
  resultId: string;
  artifactId: string;
  snapshotId: string | null;
}

export interface CaseArtifactPayload {
  title: string;
  summary: string;
  contentMarkdown: string;
}

export interface CompanySnapshotPayload {
  currentGoal: string | null;
  mainConstraint: string | null;
  dominantSituation: string | null;
  firstWaveSummary: string | null;
  toolRecommendations: DiagnosticStructuredResult["toolRecommendations"];
  summary: string;
}

export interface CaseToolRecommendationPayload {
  toolTitle: string;
  reasonNow: string;
  taskSolved: string;
  whyNotSecondary: string | null;
  toolSlug: string | null;
}
