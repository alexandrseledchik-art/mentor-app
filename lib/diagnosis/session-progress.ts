import { getSupabaseAdminClient } from "@/lib/supabase/server";

export interface PersistDiagnosisProgressParams {
  sessionId: string;
  currentStep: number | null;
  answersSnapshot: Array<{
    questionId: string;
    answerValue: number;
    answerLabel?: string | null;
  }>;
}

export async function persistDiagnosisProgress(
  params: PersistDiagnosisProgressParams,
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("diagnosis_sessions")
    .update({
      current_step: params.currentStep,
      answers: params.answersSnapshot,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.sessionId);

  if (error) {
    throw error;
  }
}
