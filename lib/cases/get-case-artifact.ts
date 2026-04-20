import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/server";

export interface CaseArtifactDetail {
  caseId: string;
  artifactType: string;
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
    .select("artifact_type, title, summary, content_markdown, created_at")
    .eq("case_id", caseRow.id)
    .in("artifact_type", ["diagnostic_result", "diagnostic_intake", "preliminary_screening"]);

  if (artifactError) {
    throw new Error(`Failed to load case artifact: ${artifactError.message}`);
  }

  if (!artifactRow || artifactRow.length === 0) {
    return null;
  }

  const selectedArtifact =
    artifactRow.find((item) => item.artifact_type === "diagnostic_result") ??
    artifactRow.find((item) => item.artifact_type === "diagnostic_intake") ??
    artifactRow[0];

  return {
    caseId: caseRow.id,
    artifactType: selectedArtifact.artifact_type,
    title: selectedArtifact.title,
    summary: selectedArtifact.summary,
    contentMarkdown: selectedArtifact.content_markdown,
    createdAt: selectedArtifact.created_at,
    completedAt: caseRow.completed_at,
  };
}
