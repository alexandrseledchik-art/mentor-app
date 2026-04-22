import "server-only";

import type { DiagnosticStructuredResult } from "@/lib/diagnostic-core/schema";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Json } from "@/types/db";

import {
  buildCaseArtifactPayload,
  buildCaseToolRecommendationPayloads,
  buildCompanySnapshotPayload,
  inferCaseConfidenceLevel,
} from "./case-result-payloads";
import { getCaseById } from "./get-case";
import { mapCaseRow } from "./mappers";
import type { CaseCompletionRecord } from "./types";

export async function completeCase(params: {
  caseId: string;
  result: DiagnosticStructuredResult;
}): Promise<CaseCompletionRecord> {
  const supabase = getSupabaseAdminClient();
  const existingCase = await getCaseById(params.caseId);

  if (!existingCase) {
    throw new Error("Case not found.");
  }

  const existingCompletion = await loadExistingCompletion(params.caseId);
  if (existingCase.status === "completed" && existingCompletion) {
    return existingCompletion;
  }

  const artifactPayload = buildCaseArtifactPayload(params.result);
  const snapshotPayload = buildCompanySnapshotPayload(params.result);
  const confidenceLevel = inferCaseConfidenceLevel(params.result);

  const { data: resultRow, error: resultError } = await supabase
    .from("case_results")
    .upsert(
      {
        case_id: existingCase.id,
        user_id: existingCase.userId,
        company_id: existingCase.companyId,
        structured_result: params.result as unknown as Json,
        confidence_level: confidenceLevel,
        main_constraint: params.result.constraints.main,
        dominant_situation: params.result.dominantSituations[0]?.name ?? null,
      },
      { onConflict: "case_id" },
    )
    .select("id")
    .single();

  if (resultError) {
    throw new Error(`Failed to persist case result: ${resultError.message}`);
  }

  const { data: artifactRow, error: artifactError } = await supabase
    .from("case_artifacts")
    .upsert(
      {
        case_id: existingCase.id,
        user_id: existingCase.userId,
        company_id: existingCase.companyId,
        title: artifactPayload.title,
        summary: artifactPayload.summary,
        content_markdown: artifactPayload.contentMarkdown,
        artifact_type: "diagnostic_result",
      },
      { onConflict: "case_id,artifact_type" },
    )
    .select("id")
    .single();

  if (artifactError) {
    throw new Error(`Failed to persist case artifact: ${artifactError.message}`);
  }

  await upsertToolRecommendations(existingCase.id, params.result);

  let snapshotId: string | null = null;
  if (existingCase.companyId) {
    const { data: snapshotRow, error: snapshotError } = await supabase
      .from("company_snapshots")
      .upsert(
        {
          company_id: existingCase.companyId,
          user_id: existingCase.userId,
          workspace_id: existingCase.workspaceId,
          source_case_id: existingCase.id,
          current_goal: snapshotPayload.currentGoal,
          main_constraint: snapshotPayload.mainConstraint,
          dominant_situation: snapshotPayload.dominantSituation,
          first_wave_summary: snapshotPayload.firstWaveSummary,
          tool_recommendations: snapshotPayload.toolRecommendations as unknown as Json,
          summary: snapshotPayload.summary,
        },
        { onConflict: "company_id" },
      )
      .select("id")
      .single();

    if (snapshotError) {
      throw new Error(`Failed to update company snapshot: ${snapshotError.message}`);
    }

    snapshotId = snapshotRow.id;
  }

  const { data: completedCaseRow, error: caseError } = await supabase
    .from("cases")
    .update({
      status: "completed",
      current_stage: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", existingCase.id)
    .select("*")
    .single();

  if (caseError) {
    throw new Error(`Failed to mark case completed: ${caseError.message}`);
  }

  return {
    case: mapCaseRow(completedCaseRow),
    resultId: resultRow.id,
    artifactId: artifactRow.id,
    snapshotId,
  };
}

async function loadExistingCompletion(caseId: string): Promise<CaseCompletionRecord | null> {
  const supabase = getSupabaseAdminClient();
  const caseRow = await getCaseById(caseId);

  if (!caseRow) {
    return null;
  }

  const { data: resultRow, error: resultError } = await supabase
    .from("case_results")
    .select("id")
    .eq("case_id", caseId)
    .maybeSingle();

  if (resultError) {
    throw new Error(`Failed to load existing case result: ${resultError.message}`);
  }

  const { data: artifactRow, error: artifactError } = await supabase
    .from("case_artifacts")
    .select("id")
    .eq("case_id", caseId)
    .eq("artifact_type", "diagnostic_result")
    .maybeSingle();

  if (artifactError) {
    throw new Error(`Failed to load existing case artifact: ${artifactError.message}`);
  }

  if (!resultRow || !artifactRow) {
    return null;
  }

  const { data: snapshotRow, error: snapshotError } = await supabase
    .from("company_snapshots")
    .select("id")
    .eq("source_case_id", caseId)
    .maybeSingle();

  if (snapshotError) {
    throw new Error(`Failed to load existing company snapshot: ${snapshotError.message}`);
  }

  return {
    case: caseRow,
    resultId: resultRow.id,
    artifactId: artifactRow.id,
    snapshotId: snapshotRow?.id ?? null,
  };
}

async function upsertToolRecommendations(caseId: string, result: DiagnosticStructuredResult) {
  const supabase = getSupabaseAdminClient();
  const rows = buildCaseToolRecommendationPayloads(result);

  for (const row of rows) {
    const { error } = await supabase.from("case_tool_recommendations").upsert(
      {
        case_id: caseId,
        tool_title: row.toolTitle,
        reason_now: row.reasonNow,
        task_solved: row.taskSolved,
        why_not_secondary: row.whyNotSecondary,
        tool_slug: row.toolSlug,
      },
      { onConflict: "case_id,tool_title" },
    );

    if (error) {
      throw new Error(`Failed to persist case tool recommendation: ${error.message}`);
    }
  }
}
