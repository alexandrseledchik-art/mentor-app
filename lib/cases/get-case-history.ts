import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/db";

export interface CaseHistoryItem {
  caseId: string;
  title: string;
  summary: string;
  status: string;
  source: string;
  companyId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  url: string;
}

export interface CompanySnapshotSummary {
  companyId: string;
  currentGoal: string | null;
  mainConstraint: string | null;
  dominantSituation: string | null;
  firstWaveSummary: string | null;
  toolRecommendations: Array<{
    title: string;
    reasonNow?: string;
    taskSolved?: string;
  }>;
  summary: string;
  updatedAt: string;
}

type CaseRow = Pick<
  Database["public"]["Tables"]["cases"]["Row"],
  | "id"
  | "company_id"
  | "completed_at"
  | "created_at"
  | "public_share_token"
  | "source"
  | "status"
  | "updated_at"
>;
type ArtifactRow = Pick<
  Database["public"]["Tables"]["case_artifacts"]["Row"],
  "artifact_type" | "case_id" | "summary" | "title"
>;
type SnapshotRow = Database["public"]["Tables"]["company_snapshots"]["Row"];

function buildCaseUrl(row: CaseRow) {
  return `/cases/${row.id}?token=${row.public_share_token}`;
}

function parseToolRecommendations(value: Json): CompanySnapshotSummary["toolRecommendations"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => ({
      title:
        item && typeof item === "object" && !Array.isArray(item)
          ? String(item.title ?? "")
          : "",
      reasonNow:
        item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        typeof item.reasonNow === "string"
          ? item.reasonNow
          : undefined,
      taskSolved:
        item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        typeof item.taskSolved === "string"
          ? item.taskSolved
          : undefined,
    }))
    .filter((item) => item.title)
    .slice(0, 4);
}

function mapSnapshot(row: SnapshotRow): CompanySnapshotSummary {
  return {
    companyId: row.company_id,
    currentGoal: row.current_goal,
    mainConstraint: row.main_constraint,
    dominantSituation: row.dominant_situation,
    firstWaveSummary: row.first_wave_summary,
    toolRecommendations: parseToolRecommendations(row.tool_recommendations),
    summary: row.summary,
    updatedAt: row.updated_at,
  };
}

export async function getCaseHistoryByUserId(
  userId: string,
  params: {
    companyId?: string | null;
    limit?: number;
  } = {},
): Promise<CaseHistoryItem[]> {
  const supabase = getSupabaseAdminClient();
  const limit = params.limit ?? 20;
  let query = supabase
    .from("cases")
    .select("id, company_id, completed_at, created_at, public_share_token, source, status, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (params.companyId) {
    query = query.eq("company_id", params.companyId);
  }

  const { data: caseRows, error: caseError } = await query;

  if (caseError) {
    throw new Error(`Failed to load case history: ${caseError.message}`);
  }

  if (!caseRows || caseRows.length === 0) {
    return [];
  }

  const caseIds = caseRows.map((row) => row.id);
  const { data: artifactRows, error: artifactError } = await supabase
    .from("case_artifacts")
    .select("artifact_type, case_id, title, summary")
    .in("case_id", caseIds)
    .in("artifact_type", ["diagnostic_result", "diagnostic_intake", "preliminary_screening"]);

  if (artifactError) {
    throw new Error(`Failed to load case artifacts: ${artifactError.message}`);
  }

  const artifacts = new Map<string, ArtifactRow>();

  for (const row of artifactRows ?? []) {
    const artifact = row as ArtifactRow;
    const existing = artifacts.get(artifact.case_id);

    if (
      !existing ||
      artifact.artifact_type === "diagnostic_result" ||
      (artifact.artifact_type === "diagnostic_intake" && existing.artifact_type === "preliminary_screening")
    ) {
      artifacts.set(artifact.case_id, artifact);
    }
  }

  return caseRows.map((row) => {
    const caseRow = row as CaseRow;
    const artifact = artifacts.get(caseRow.id);

    return {
      caseId: caseRow.id,
      title: artifact?.title ?? "Диагностический разбор",
      summary: artifact?.summary ?? "Разбор сохранён, подробности доступны внутри.",
      status: caseRow.status,
      source: caseRow.source,
      companyId: caseRow.company_id,
      createdAt: caseRow.created_at,
      updatedAt: caseRow.updated_at,
      completedAt: caseRow.completed_at,
      url: buildCaseUrl(caseRow),
    };
  });
}

export async function getLatestCaseByUserId(
  userId: string,
  companyId?: string | null,
): Promise<CaseHistoryItem | null> {
  const items = await getCaseHistoryByUserId(userId, {
    companyId,
    limit: 1,
  });

  return items[0] ?? null;
}

export async function getCaseHistoryCountByUserId(
  userId: string,
  companyId?: string | null,
): Promise<number> {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("cases")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(`Failed to count cases: ${error.message}`);
  }

  return count ?? 0;
}

export async function getCompanySnapshotSummary(
  companyId: string,
): Promise<CompanySnapshotSummary | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("company_snapshots")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load company snapshot: ${error.message}`);
  }

  return data ? mapSnapshot(data as SnapshotRow) : null;
}
