import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/types/db";
import type { Company, DiagnosisSession } from "@/types/domain";

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
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export interface DashboardWorkspaceContext {
  user: AppUserIdentity;
  workspace: Workspace;
  activeCompany: Company | null;
  latestDiagnosis: DiagnosisSession | null;
}

export async function getDashboardWorkspaceContext(): Promise<DashboardWorkspaceContext | null> {
  const user = await getCurrentAppUser();

  if (!user) {
    return null;
  }

  const workspace = await getOrCreateWorkspace(user.id);
  const supabase = getSupabaseAdminClient();

  let activeCompany: Company | null = null;
  let latestDiagnosis: DiagnosisSession | null = null;

  if (workspace.activeCompanyId) {
    const [{ data: company }, { data: diagnosis }] = await Promise.all([
      supabase
        .from("companies")
        .select("*")
        .eq("id", workspace.activeCompanyId)
        .maybeSingle(),
      supabase
        .from("diagnosis_sessions")
        .select("*")
        .eq("company_id", workspace.activeCompanyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    activeCompany = company ? mapCompany(company as CompanyRow) : null;
    latestDiagnosis = diagnosis ? mapDiagnosisSession(diagnosis as DiagnosisSessionRow) : null;
  }

  return {
    user,
    workspace,
    activeCompany,
    latestDiagnosis,
  };
}
