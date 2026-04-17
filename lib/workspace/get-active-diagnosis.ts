import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/types/db";
import type { DiagnosisAnswerInput, DiagnosisSession } from "@/types/domain";

import { getOrCreateWorkspace } from "./get-or-create-workspace";

type SessionRow = Database["public"]["Tables"]["diagnosis_sessions"]["Row"];

function isActiveDiagnosisStatus(status: string) {
  return status === "draft" || status === "in_progress";
}

function parseAnswersSnapshot(value: SessionRow["answers"]) {
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

function mapSession(row: SessionRow): DiagnosisSession {
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

export async function getActiveDiagnosisSession(userId: string): Promise<DiagnosisSession | null> {
  const workspace = await getOrCreateWorkspace(userId);

  if (!workspace.activeDiagnosisSessionId) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data: session, error } = await supabase
    .from("diagnosis_sessions")
    .select("*")
    .eq("id", workspace.activeDiagnosisSessionId)
    .maybeSingle();

  if (error || !session || !isActiveDiagnosisStatus(session.status)) {
    return null;
  }

  return mapSession(session as SessionRow);
}
