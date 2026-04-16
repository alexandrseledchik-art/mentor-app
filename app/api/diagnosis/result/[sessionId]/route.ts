import { NextResponse } from "next/server";

import {
  buildDiagnosisSummary,
  calculateDimensionScores,
} from "@/lib/diagnosis/summary";
import { parseQuestionOptions } from "@/lib/diagnosis/mappers";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { DiagnosisResultResponse } from "@/types/api";
import type { Database } from "@/types/db";
import type {
  DiagnosisAnswerInput,
  DiagnosisQuestion,
  DiagnosisQuestionSet,
  RecommendedTool,
  DiagnosisSession,
} from "@/types/domain";
import { diagnosisResultResponseSchema } from "@/validators/diagnosis";

type QuestionSetRow = Database["public"]["Tables"]["diagnosis_question_sets"]["Row"];
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

function mapQuestionSet(row: QuestionSetRow): DiagnosisQuestionSet {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description,
    version: row.version,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

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

function mapAnswer(row: AnswerRow): DiagnosisAnswerInput {
  return {
    questionId: row.question_id,
    answerValue: row.answer_value,
    answerLabel: row.answer_label,
  };
}

function mapRecommendedTool(row: ToolRow, whyRecommended: string): RecommendedTool {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    whyRecommended,
    externalUrl: `/tools/${row.slug}`,
  };
}

async function loadRecommendedTools(params: {
  dimensionScores: Array<{ dimension: string; averageScore: number }>;
}) {
  const sections = Array.from(
    new Set(
      params.dimensionScores
        .filter((item) => item.averageScore <= 2)
        .map((item) => dimensionSectionMap[item.dimension])
        .filter(Boolean),
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

  const orderedMappings = mappings as SymptomToolMapRow[];
  const toolIds = Array.from(new Set(orderedMappings.map((item) => item.tool_id)));
  const { data: tools, error: toolsError } = await supabase
    .from("tools")
    .select("*")
    .in("id", toolIds);

  if (toolsError || !tools?.length) {
    return [];
  }

  const toolById = new Map((tools as ToolRow[]).map((tool) => [tool.id, tool]));
  const recommended: RecommendedTool[] = [];

  for (const mapping of orderedMappings) {
    const tool = toolById.get(mapping.tool_id);
    const symptom = symptomById.get(mapping.symptom_id);

    if (!tool) {
      continue;
    }

    if (recommended.some((item) => item.id === tool.id)) {
      continue;
    }

    recommended.push(
      mapRecommendedTool(
        tool,
        symptom?.reason || "Этот инструмент связан с одной из самых слабых зон диагностики.",
      ),
    );

    if (recommended.length === 3) {
      break;
    }
  }

  return recommended;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  const supabase = getSupabaseAdminClient();

  const { data: session, error: sessionError } = await supabase
    .from("diagnosis_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Diagnosis session not found." }, { status: 404 });
  }

  const [{ data: questionSet, error: setError }, { data: questions, error: questionsError }, { data: answers, error: answersError }] =
    await Promise.all([
      supabase
        .from("diagnosis_question_sets")
        .select("*")
        .eq("id", session.question_set_id)
        .single(),
      supabase
        .from("diagnosis_questions")
        .select("*")
        .eq("question_set_id", session.question_set_id)
        .order("order_index", { ascending: true, nullsFirst: false })
        .order("position", { ascending: true }),
      supabase
        .from("diagnosis_answers")
        .select("*")
        .eq("diagnosis_session_id", session.id),
    ]);

  if (setError || !questionSet) {
    return NextResponse.json({ error: "Question set not found." }, { status: 404 });
  }

  if (questionsError || !questions) {
    return NextResponse.json({ error: "Questions not found." }, { status: 404 });
  }

  if (answersError || !answers) {
    return NextResponse.json({ error: "Answers not found." }, { status: 404 });
  }

  const mappedQuestions = questions.map(mapQuestion);
  const mappedAnswers = answers.map(mapAnswer);
  const dimensionScores = calculateDimensionScores(mappedAnswers, mappedQuestions);
  const recommendedTools = await loadRecommendedTools({
    dimensionScores,
  });
  const payload: DiagnosisResultResponse = {
    questionSet: mapQuestionSet(questionSet),
    questions: mappedQuestions,
    session: mapSession(session),
    answers: mappedAnswers,
    dimensionScores,
    summary: buildDiagnosisSummary(mappedAnswers, mappedQuestions),
    tools: recommendedTools,
  };

  return NextResponse.json(diagnosisResultResponseSchema.parse(payload));
}
