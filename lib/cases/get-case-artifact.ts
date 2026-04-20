import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/server";

export interface CaseArtifactDetail {
  caseId: string;
  title: string;
  summary: string;
  contentMarkdown: string;
  createdAt: string;
  completedAt: string | null;
}

export async function getCaseArtifactByShareToken(params: {
  caseId: string;
  token: string;
}): Promise<CaseArtifactDetail | null> {
  const supabase = getSupabaseAdminClient();

  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .select("id, completed_at")
    .eq("id", params.caseId)
    .eq("public_share_token", params.token)
    .maybeSingle();

  if (caseError) {
    throw new Error(`Failed to load shared case: ${caseError.message}`);
  }

  if (!caseRow) {
    return null;
  }

  const { data: artifactRow, error: artifactError } = await supabase
    .from("case_artifacts")
    .select("title, summary, content_markdown, created_at")
    .eq("case_id", caseRow.id)
    .eq("artifact_type", "diagnostic_result")
    .maybeSingle();

  if (artifactError) {
    throw new Error(`Failed to load case artifact: ${artifactError.message}`);
  }

  if (!artifactRow) {
    return null;
  }

  return {
    caseId: caseRow.id,
    title: artifactRow.title,
    summary: artifactRow.summary,
    contentMarkdown: artifactRow.content_markdown,
    createdAt: artifactRow.created_at,
    completedAt: caseRow.completed_at,
  };
}
