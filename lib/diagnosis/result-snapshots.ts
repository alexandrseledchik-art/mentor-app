import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { DiagnosisDimensionScore, DiagnosisResultSummary } from "@/types/domain";
import type { Database, Json } from "@/types/db";

export interface CreateResultSnapshotParams {
  diagnosisSessionId: string;
  userId: string;
  companyId: string;
  workspaceId: string | null;
  overallScore: number | null;
  dimensionScores: DiagnosisDimensionScore[];
  weakestZones: string[];
  strongestZones: string[];
  summary: DiagnosisResultSummary;
  recommendedTools: Array<{
    title: string;
    whyRecommended: string;
  }>;
}

export async function createResultSnapshot(
  params: CreateResultSnapshotParams,
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("result_snapshots")
    .select("id")
    .eq("diagnosis_session_id", params.diagnosisSessionId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return;
  }

  const payload: Database["public"]["Tables"]["result_snapshots"]["Insert"] = {
    diagnosis_session_id: params.diagnosisSessionId,
    user_id: params.userId,
    company_id: params.companyId,
    workspace_id: params.workspaceId,
    overall_score: params.overallScore,
    dimension_scores: params.dimensionScores as unknown as Json,
    weakest_zones: params.weakestZones as unknown as Json,
    strongest_zones: params.strongestZones as unknown as Json,
    summary: params.summary as unknown as Json,
    recommended_tools: params.recommendedTools as unknown as Json,
  };

  const { error } = await supabase
    .from("result_snapshots")
    .insert(payload);

  if (error) {
    throw error;
  }
}
