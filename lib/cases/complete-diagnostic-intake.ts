import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/server";

import { getCaseById } from "./get-case";
import { mapCaseRow } from "./mappers";
import type { BusinessCase } from "./types";

export interface DiagnosticIntakeCompletion {
  case: BusinessCase;
  artifactId: string;
}

export async function completeDiagnosticIntake(params: {
  caseId: string;
  title: string;
  summary: string;
  contentMarkdown: string;
}): Promise<DiagnosticIntakeCompletion> {
  const supabase = getSupabaseAdminClient();
  const existingCase = await getCaseById(params.caseId);

  if (!existingCase) {
    throw new Error("Case not found.");
  }

  const { data: artifactRow, error: artifactError } = await supabase
    .from("case_artifacts")
    .upsert(
      {
        case_id: existingCase.id,
        user_id: existingCase.userId,
        company_id: existingCase.companyId,
        title: params.title,
        summary: params.summary,
        content_markdown: params.contentMarkdown,
        artifact_type: "diagnostic_intake",
      },
      { onConflict: "case_id,artifact_type" },
    )
    .select("id")
    .single();

  if (artifactError) {
    throw new Error(`Failed to persist diagnostic intake: ${artifactError.message}`);
  }

  const { data: completedCaseRow, error: caseError } = await supabase
    .from("cases")
    .update({
      status: "completed",
      current_stage: "diagnostic_intake",
      completed_at: new Date().toISOString(),
    })
    .eq("id", existingCase.id)
    .select("*")
    .single();

  if (caseError) {
    throw new Error(`Failed to mark diagnostic intake completed: ${caseError.message}`);
  }

  return {
    case: mapCaseRow(completedCaseRow),
    artifactId: artifactRow.id,
  };
}
