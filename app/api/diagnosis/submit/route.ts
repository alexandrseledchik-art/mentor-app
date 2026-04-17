import { NextResponse } from "next/server";

import { trackDiagnosisCompleted } from "@/lib/analytics/diagnosis-analytics";
import { parseQuestionOptions } from "@/lib/diagnosis/mappers";
import { createResultSnapshot } from "@/lib/diagnosis/result-snapshots";
import {
  buildDiagnosisSummary,
  calculateDiagnosisTotalScore,
  calculateDimensionScores,
} from "@/lib/diagnosis/summary";
import { persistDiagnosisProgress } from "@/lib/diagnosis/session-progress";
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
type AnswerRow = Database["public"]["Tables"]["diagnosis_answers"]["Row"];
type SymptomRow = Database["public"]["Tables"]["symptoms"]["Row"];
type SymptomToolMapRow = Database["public"]["Tables"]["symptom_tool_map"]["Row"];
type ToolRow = Database["public"]["Tables"]["tools"]["Row"];

const dimensionSectionMap: Record<string, string> = {
  owner: "УПРАВЛЕНИЕ И РИСКИ",
  external_environment: "ВНЕШНЯЯ СРЕДА",
  strategy: "СТРАТЕГИЯ",
  product: "СТРАТЕГИЯ",
  commercial: "КОММЕРЦИЯ",
  operations: "ОПЕРАЦИОННАЯ МОДЕЛЬ",
  finance: "ФИНАНСЫ",
  team: "ЛЮДИ И ОРГАНИЗАЦИЯ",
  governance: "УПРАВЛЕНИЕ И РИСКИ",
  technology: "ТЕХНОЛОГИИ",
  data: "ДАННЫЕ И АНАЛИТИКА",
};

const dimensionLabelMap: Record<string, string> = {
  owner: "Роль собственника",
  external_environment: "Внешняя среда и рынок",
  strategy: "Стратегия и направление",
  product: "Продукт",
  commercial: "Коммерция",
  operations: "Операции",
  finance: "Финансы",
  team: "Команда",
  governance: "Управление и принятие решений",
  technology: "Технологии",
  data: "Данные и аналитика",
};

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

function parseAnswersSnapshot(value: Database["public"]["Tables"]["diagnosis_sessions"]["Row"]["answers"]) {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsed = value.reduce<NonNullable<DiagnosisSession["answersSnapshot"]>>((accumulator, item) => {
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

function mapAnswer(row: AnswerRow) {
  return {
    questionId: row.question_id,
    answerValue: row.answer_value,
    answerLabel: row.answer_label,
  };
}

function mapRecommendedTool(row: ToolRow, whyRecommended: string) {
  return {
    title: row.title,
    whyRecommended,
  };
}

async function loadRecommendedTools(params: {
  dimensionScores: Array<{ dimension: string; averageScore: number }>;
}) {
  const weakestDimensions = params.dimensionScores
    .filter((item) => item.averageScore <= 2)
    .slice()
    .sort((a, b) => a.averageScore - b.averageScore);

  const sections = Array.from(
    new Set(
      weakestDimensions.map((item) => dimensionSectionMap[item.dimension]).filter(Boolean),
    ),
  );

  if (sections.length === 0) {
    return [];
  }

  const supabase = getSupabaseAdminClient();
  const { data: symptoms, error: symptomsError } = await supabase
    .from("symptoms")
    .select("*")
    .in("section", sections);

  if (symptomsError || !symptoms?.length) {
    return [];
  }

  const symptomIds = symptoms.map((item: SymptomRow) => item.id);
  const symptomById = new Map((symptoms as SymptomRow[]).map((symptom) => [symptom.id, symptom]));

  const { data: mappings, error: mappingsError } = await supabase
    .from("symptom_tool_map")
    .select("*")
    .in("symptom_id", symptomIds)
    .order("priority", { ascending: true });

  if (mappingsError || !mappings?.length) {
    return [];
  }

  const toolIds = Array.from(new Set((mappings as SymptomToolMapRow[]).map((item) => item.tool_id)));
  const { data: tools, error: toolsError } = await supabase
    .from("tools")
    .select("*")
    .in("id", toolIds);

  if (toolsError || !tools?.length) {
    return [];
  }

  const toolById = new Map((tools as ToolRow[]).map((tool) => [tool.id, tool]));
  const recommended: Array<{ title: string; whyRecommended: string }> = [];

  for (const mapping of mappings as SymptomToolMapRow[]) {
    const tool = toolById.get(mapping.tool_id);
    const symptom = symptomById.get(mapping.symptom_id);

    if (!tool || recommended.some((item) => item.title === tool.title)) {
      continue;
    }

    const matchedWeakDimension = weakestDimensions.find(
      (item) => dimensionSectionMap[item.dimension] === symptom?.section,
    )?.dimension;

    recommended.push(
      mapRecommendedTool(
        tool,
        `Рекомендован, потому что у вас проседает контур «${
          dimensionLabelMap[matchedWeakDimension ?? ""] ?? "эта зона"
        }», а этот инструмент помогает ${
          (symptom?.reason ?? "навести базовую управляемость в проблемной зоне")
            .charAt(0)
            .toLowerCase() +
          (symptom?.reason ?? "навести базовую управляемость в проблемной зоне").slice(1)
        }.`,
      ),
    );

    if (recommended.length === 3) {
      break;
    }
  }

  return recommended;
}

async function resolveSessionUserId(params: {
  session: SessionRow;
  fallbackSession: SessionRow;
}) {
  if (params.session.user_id) {
    return params.session.user_id;
  }

  if (params.fallbackSession.user_id) {
    return params.fallbackSession.user_id;
  }

  const supabase = getSupabaseAdminClient();
  const { data: company, error } = await supabase
    .from("companies")
    .select("user_id")
    .eq("id", params.fallbackSession.company_id)
    .maybeSingle();

  if (error || !company?.user_id) {
    throw error ?? new Error("Failed to resolve diagnosis session user.");
  }

  return company.user_id;
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

  const { data: storedAnswers, error: storedAnswersError } = await supabase
    .from("diagnosis_answers")
    .select("*")
    .eq("diagnosis_session_id", sessionId);

  if (storedAnswersError || !storedAnswers) {
    return NextResponse.json({ error: "Failed to load diagnosis answers." }, { status: 500 });
  }

  const canonicalAnswers = (storedAnswers as AnswerRow[]).map(mapAnswer);
  const answeredCount = canonicalAnswers.length;
  const totalQuestionCount = mappedQuestions.length;
  const totalScore = calculateDiagnosisTotalScore(canonicalAnswers, mappedQuestions);
  const summary = buildDiagnosisSummary(canonicalAnswers, mappedQuestions);
  const isComplete = answeredCount >= totalQuestionCount;
  const nextStep = isComplete ? totalQuestionCount : Math.min(answeredCount + 1, totalQuestionCount);

  try {
    await persistDiagnosisProgress({
      sessionId,
      currentStep: nextStep,
      answersSnapshot: canonicalAnswers,
    });
  } catch (error) {
    console.error("DIAGNOSIS PROGRESS PERSIST ERROR:", error);
    return NextResponse.json({ error: "Failed to persist diagnosis progress." }, { status: 500 });
  }

  let finalSessionRow: SessionRow | null = null;

  if (isComplete) {
    const completedAt = session.completed_at ?? new Date().toISOString();
    const { data: updatedSession, error: updateError } = await supabase
      .from("diagnosis_sessions")
      .update({
        status: "completed",
        total_score: totalScore,
        score_overall: totalScore,
        summary_key: summary.key,
        completed_at: completedAt,
        current_step: totalQuestionCount,
        answers: canonicalAnswers,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .select("*")
      .single();

    if (updateError || !updatedSession) {
      return NextResponse.json({ error: "Failed to finalize diagnosis session." }, { status: 500 });
    }

    finalSessionRow = updatedSession as SessionRow;

    if (finalSessionRow.user_id) {
      const { error: workspaceError } = await supabase
        .from("workspaces")
        .update({
          active_diagnosis_session_id: null,
          last_completed_diagnosis_session_id: finalSessionRow.id,
          last_visited_route: `/diagnosis/${finalSessionRow.id}`,
        })
        .eq("user_id", finalSessionRow.user_id);

      if (workspaceError) {
        return NextResponse.json({ error: "Failed to update workspace state." }, { status: 500 });
      }
    }

    const dimensionScores = calculateDimensionScores(canonicalAnswers, mappedQuestions);
    const weakestZones = dimensionScores
      .slice()
      .sort((a, b) => a.averageScore - b.averageScore)
      .slice(0, 2)
      .map((item) => item.dimension);
    const strongestZones = dimensionScores
      .slice()
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 2)
      .map((item) => item.dimension);
    const recommendedTools = await loadRecommendedTools({ dimensionScores });
    const snapshotUserId = await resolveSessionUserId({
      session,
      fallbackSession: finalSessionRow,
    });

    try {
      await createResultSnapshot({
        diagnosisSessionId: finalSessionRow.id,
        userId: snapshotUserId,
        companyId: finalSessionRow.company_id,
        overallScore: totalScore,
        dimensionScores,
        weakestZones,
        strongestZones,
        summary,
        recommendedTools,
      });
    } catch (error) {
      console.error("RESULT SNAPSHOT CREATE ERROR:", error);
      return NextResponse.json({ error: "Failed to create result snapshot." }, { status: 500 });
    }

    await trackDiagnosisCompleted({
      userId: finalSessionRow.user_id,
      companyId: finalSessionRow.company_id,
      diagnosisSessionId: finalSessionRow.id,
      summaryKey: summary.key,
      totalScore,
      answeredCount,
    });
  } else {
    const { data: updatedSession, error: sessionUpdateError } = await supabase
      .from("diagnosis_sessions")
      .update({
        status: "in_progress",
        current_step: nextStep,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .select("*")
      .single();

    if (sessionUpdateError || !updatedSession) {
      return NextResponse.json({ error: "Failed to update diagnosis session." }, { status: 500 });
    }

    finalSessionRow = updatedSession as SessionRow;
  }

  const payload: DiagnosisSubmitResponse = {
    session: mapSession(finalSessionRow),
    totalScore,
    answeredCount,
    summaryKey: summary.key,
  };

  return NextResponse.json(diagnosisSubmitResponseSchema.parse(payload));
}
