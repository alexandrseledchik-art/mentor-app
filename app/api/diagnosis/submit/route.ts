import { NextResponse } from "next/server";

import { parseQuestionOptions } from "@/lib/diagnosis/mappers";
import { buildDiagnosisSummary, calculateDiagnosisTotalScore } from "@/lib/diagnosis/summary";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { DiagnosisSubmitRequest, DiagnosisSubmitResponse } from "@/types/api";
import type { Database } from "@/types/db";
import type { DiagnosisQuestion, DiagnosisSession } from "@/types/domain";
import {
  diagnosisSubmitRequestSchema,
  diagnosisSubmitResponseSchema,
} from "@/validators/diagnosis";

type QuestionRow = Database["public"]["Tables"]["diagnosis_questions"]["Row"];
type SessionRow = Database["public"]["Tables"]["diagnosis_sessions"]["Row"];

function mapQuestion(row: QuestionRow): DiagnosisQuestion {
  return {
    id: row.id,
    questionSetId: row.question_set_id,
    code: row.code,
    title: row.title ?? null,
    questionText: row.question_text ?? row.title,
    dimension: row.dimension as DiagnosisQuestion["dimension"],
    position: row.position ?? null,
    orderIndex: row.order_index ?? row.position,
    inputType: row.input_type === "single_select" ? "single_select" : "scale",
    isRequired: row.is_required,
    options: parseQuestionOptions(row.options),
    weight: row.weight ?? 1,
    meta:
      row.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
        ? (row.meta as Record<string, unknown>)
        : {},
    createdAt: row.created_at,
  };
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
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export async function POST(request: Request) {
  const body = (await request.json()) as DiagnosisSubmitRequest;
  const parsed = diagnosisSubmitRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid diagnosis submit payload.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdminClient();
  const { sessionId, answers } = parsed.data;
  const normalizedAnswers = answers.map((answer) => ({
    questionId: answer.questionId,
    answerValue: answer.value,
    answerLabel: null,
  }));

  const { data: session, error: sessionError } = await supabase
    .from("diagnosis_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Diagnosis session not found." }, { status: 404 });
  }

  const { data: questions, error: questionsError } = await supabase
    .from("diagnosis_questions")
    .select("*")
    .eq("question_set_id", session.question_set_id)
    .order("order_index", { ascending: true, nullsFirst: false })
    .order("position", { ascending: true });

  if (questionsError || !questions) {
    return NextResponse.json({ error: "Questions not found for this session." }, { status: 404 });
  }

  const mappedQuestions = questions.map(mapQuestion);
  const questionIds = new Set(mappedQuestions.map((question) => question.id));
  const uniqueAnswerQuestionIds = new Set(
    normalizedAnswers.map((answer) => answer.questionId),
  );

  if (uniqueAnswerQuestionIds.size !== answers.length) {
    return NextResponse.json({ error: "Each question can be answered only once." }, { status: 400 });
  }

  const hasForeignQuestion = normalizedAnswers.some(
    (answer) => !questionIds.has(answer.questionId),
  );

  if (hasForeignQuestion) {
    return NextResponse.json(
      { error: "Some answers do not belong to the selected diagnosis." },
      { status: 400 },
    );
  }

  const answerRows = normalizedAnswers.map((answer) => {
    const question = mappedQuestions.find((item) => item.id === answer.questionId);
    const optionLabel =
      question?.options.find((option) => option.value === answer.answerValue)?.label ?? null;

    return {
      diagnosis_session_id: sessionId,
      question_id: answer.questionId,
      answer_value: answer.answerValue,
      answer_label: answer.answerLabel ?? optionLabel,
    };
  });

  const { error: upsertError } = await supabase
    .from("diagnosis_answers")
    .upsert(answerRows, { onConflict: "diagnosis_session_id,question_id" });

  if (upsertError) {
    return NextResponse.json({ error: "Failed to save diagnosis answers." }, { status: 500 });
  }

  const totalScore = calculateDiagnosisTotalScore(normalizedAnswers, mappedQuestions);
  const summary = buildDiagnosisSummary(normalizedAnswers, mappedQuestions);

  const { data: updatedSession, error: updateError } = await supabase
    .from("diagnosis_sessions")
    .update({
      status: "completed",
      total_score: totalScore,
      summary_key: summary.key,
      completed_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .select("*")
    .single();

  if (updateError || !updatedSession) {
    return NextResponse.json({ error: "Failed to finalize diagnosis session." }, { status: 500 });
  }

  const payload: DiagnosisSubmitResponse = {
    session: mapSession(updatedSession),
    totalScore,
    answeredCount: normalizedAnswers.length,
    summaryKey: summary.key,
  };

  return NextResponse.json(diagnosisSubmitResponseSchema.parse(payload));
}
