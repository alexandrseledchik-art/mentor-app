import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getLatestResultSnapshotByCompanyId } from "@/lib/diagnosis/get-latest-result-snapshot";
import {
  getCaseHistoryCountByUserId,
  getCompanySnapshotSummary,
  getLatestCaseByUserId,
  type CaseHistoryItem,
  type CompanySnapshotSummary,
} from "@/lib/cases/get-case-history";
import type { Database } from "@/types/db";
import type {
  Company,
  DiagnosisAnswerInput,
  DiagnosisResultHistoryItem,
  DiagnosisSession,
} from "@/types/domain";

import { getActiveDiagnosisSession } from "./get-active-diagnosis";
import { getCurrentAppUser } from "./get-current-app-user";
import { getOrCreateWorkspace } from "./get-or-create-workspace";
import type { AppUserIdentity, Workspace } from "./types";

type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
type DiagnosisSessionRow = Database["public"]["Tables"]["diagnosis_sessions"]["Row"];

function mapCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    industry: row.industry,
    teamSize: row.team_size,
    revenueRange: row.revenue_range,
    description: row.description,
    primaryGoal: row.primary_goal,
    onboardingCompleted: row.onboarding_completed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseAnswersSnapshot(value: DiagnosisSessionRow["answers"]) {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsed = value.reduce<DiagnosisAnswerInput[]>((accumulator, item) => {
    if (
      item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      "questionId" in item &&
      "answerValue" in item &&
      typeof item.questionId === "string" &&
      typeof item.answerValue === "number"
    ) {
      accumulator.push({
        questionId: item.questionId,
        answerValue: item.answerValue,
        answerLabel:
          "answerLabel" in item && typeof item.answerLabel === "string"
            ? item.answerLabel
            : null,
      });
    }

    return accumulator;
  }, []);

  return parsed.length > 0 ? parsed : null;
}

function mapDiagnosisSession(row: DiagnosisSessionRow): DiagnosisSession {
  return {
    id: row.id,
    companyId: row.company_id,
    questionSetId: row.question_set_id,
    status: row.status === "completed" ? "completed" : "in_progress",
    totalScore: row.total_score,
    summaryKey:
      row.summary_key === "low" || row.summary_key === "medium" || row.summary_key === "high"
        ? row.summary_key
        : null,
    currentStep: row.current_step ?? null,
    answersSnapshot: parseAnswersSnapshot(row.answers),
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export interface DashboardWorkspaceContext {
  user: AppUserIdentity;
  workspace: Workspace;
  activeCompany: Company | null;
  activeDiagnosis: DiagnosisSession | null;
  lastCompletedDiagnosis: DiagnosisSession | null;
  latestResultSnapshot: DiagnosisResultHistoryItem | null;
  resultHistoryCount: number;
  latestCase: CaseHistoryItem | null;
  caseHistoryCount: number;
  companySnapshot: CompanySnapshotSummary | null;
}

export async function getDashboardWorkspaceContext(): Promise<DashboardWorkspaceContext | null> {
  const user = await getCurrentAppUser();

  if (!user) {
    return null;
  }

  const workspace = await getOrCreateWorkspace(user.id);
  const supabase = getSupabaseAdminClient();

  let activeCompany: Company | null = null;
  const activeDiagnosis = await getActiveDiagnosisSession(user.id);
  let lastCompletedDiagnosis: DiagnosisSession | null = null;
  let latestResultSnapshot: DiagnosisResultHistoryItem | null = null;
  let resultHistoryCount = 0;
  let latestCase: CaseHistoryItem | null = null;
  let caseHistoryCount = 0;
  let companySnapshot: CompanySnapshotSummary | null = null;

  if (workspace.activeCompanyId) {
    const [
      { data: company },
      lastCompletedResult,
      latestSnapshot,
      historyCountResult,
      latestCaseResult,
      caseCountResult,
      companySnapshotResult,
    ] = await Promise.all([
      supabase
        .from("companies")
        .select("*")
        .eq("id", workspace.activeCompanyId)
        .maybeSingle(),
      workspace.lastCompletedDiagnosisSessionId
        ? supabase
            .from("diagnosis_sessions")
            .select("*")
            .eq("id", workspace.lastCompletedDiagnosisSessionId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      getLatestResultSnapshotByCompanyId(workspace.activeCompanyId),
      supabase
        .from("result_snapshots")
        .select("*", { count: "exact", head: true })
        .eq("company_id", workspace.activeCompanyId),
      getLatestCaseByUserId(user.id, workspace.activeCompanyId),
      getCaseHistoryCountByUserId(user.id, workspace.activeCompanyId),
      getCompanySnapshotSummary(workspace.activeCompanyId),
    ]);

    activeCompany = company ? mapCompany(company as CompanyRow) : null;
    lastCompletedDiagnosis = lastCompletedResult.data
      ? mapDiagnosisSession(lastCompletedResult.data as DiagnosisSessionRow)
      : null;
    latestResultSnapshot = latestSnapshot;
    resultHistoryCount = historyCountResult.count ?? 0;
    latestCase = latestCaseResult;
    caseHistoryCount = caseCountResult;
    companySnapshot = companySnapshotResult;
  } else {
    latestCase = await getLatestCaseByUserId(user.id);
    caseHistoryCount = await getCaseHistoryCountByUserId(user.id);
  }

  return {
    user,
    workspace,
    activeCompany,
    activeDiagnosis,
    lastCompletedDiagnosis,
    latestResultSnapshot,
    resultHistoryCount,
    latestCase,
    caseHistoryCount,
    companySnapshot,
  };
}
