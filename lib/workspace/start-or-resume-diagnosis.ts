import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/types/db";
import type { DiagnosisAnswerInput, DiagnosisSession } from "@/types/domain";

import { getActiveDiagnosisSession } from "./get-active-diagnosis";

type SessionRow = Database["public"]["Tables"]["diagnosis_sessions"]["Row"];

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

export interface StartOrResumeDiagnosisParams {
  userId: string;
  companyId: string;
  questionSetId: string;
}

export interface StartOrResumeDiagnosisResult {
  session: DiagnosisSession;
  resumed: boolean;
}

export async function startOrResumeDiagnosis(
  params: StartOrResumeDiagnosisParams,
): Promise<StartOrResumeDiagnosisResult> {
  const activeSession = await getActiveDiagnosisSession(params.userId);

  if (activeSession) {
    return {
      session: activeSession,
      resumed: true,
    };
  }

  const supabase = getSupabaseAdminClient();
  const { data: session, error } = await supabase
    .from("diagnosis_sessions")
    .insert({
      user_id: params.userId,
      company_id: params.companyId,
      question_set_id: params.questionSetId,
      status: "in_progress",
      started_at: new Date().toISOString(),
      current_step: 1,
      answers: [],
    })
    .select("*")
    .single();

  if (error || !session) {
    throw error ?? new Error("Failed to create diagnosis session.");
  }

  const { error: workspaceError } = await supabase
    .from("workspaces")
    .update({
      active_diagnosis_session_id: session.id,
      last_visited_route: "/diagnosis",
    })
    .eq("user_id", params.userId);

  if (workspaceError) {
    throw workspaceError;
  }

  return {
    session: mapSession(session as SessionRow),
    resumed: false,
  };
}
