import "server-only";

import {
  buildDiagnosisSummary,
  calculateDimensionScores,
} from "@/lib/diagnosis/summary";
import { parseQuestionOptions } from "@/lib/diagnosis/mappers";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/types/db";
import type {
  AiResultInterpretationContext,
  Company,
  DiagnosisAnswerInput,
  DiagnosisDimensionScore,
  DiagnosisQuestion,
  DiagnosisResultSummary,
} from "@/types/domain";

type SessionRow = Database["public"]["Tables"]["diagnosis_sessions"]["Row"];
type QuestionRow = Database["public"]["Tables"]["diagnosis_questions"]["Row"];
type AnswerRow = Database["public"]["Tables"]["diagnosis_answers"]["Row"];
type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
type SymptomRow = Database["public"]["Tables"]["symptoms"]["Row"];
type SymptomToolMapRow = Database["public"]["Tables"]["symptom_tool_map"]["Row"];
type ToolRow = Database["public"]["Tables"]["tools"]["Row"];
type ResultSnapshotRow = Database["public"]["Tables"]["result_snapshots"]["Row"];

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

function mapAnswer(row: AnswerRow): DiagnosisAnswerInput {
  return {
    questionId: row.question_id,
    answerValue: row.answer_value,
    answerLabel: row.answer_label,
  };
}

function mapCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    industry: row.industry,
    teamSize: row.team_size,
    revenueRange: row.revenue_range,
    description: row.description,
    primaryGoal: row.primary_goal,
    onboardingCompleted: row.onboarding_completed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function parseDimensionScores(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<DiagnosisDimensionScore[]>((accumulator, item) => {
    if (
      item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      "dimension" in item &&
      "averageScore" in item &&
      typeof item.dimension === "string" &&
      typeof item.averageScore === "number"
    ) {
      accumulator.push({
        dimension: item.dimension,
        averageScore: item.averageScore,
      });
    }

    return accumulator;
  }, []);
}

function parseSummary(value: unknown): DiagnosisResultSummary | null {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "key" in value &&
    "title" in value &&
    "description" in value &&
    "strengths" in value &&
    "risks" in value &&
    (value.key === "low" || value.key === "medium" || value.key === "high") &&
    typeof value.title === "string" &&
    typeof value.description === "string"
  ) {
    return {
      key: value.key,
      title: value.title,
      description: value.description,
      strengths: parseStringArray(value.strengths),
      risks: parseStringArray(value.risks),
    };
  }

  return null;
}

function parseRecommendedTools(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<Array<{ title: string; whyRecommended: string }>>((accumulator, item) => {
    if (
      item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      "title" in item &&
      "whyRecommended" in item &&
      typeof item.title === "string" &&
      typeof item.whyRecommended === "string"
    ) {
      accumulator.push({
        title: item.title,
        whyRecommended: item.whyRecommended,
      });
    }

    return accumulator;
  }, []);
}

async function loadRecommendedTools(params: {
  dimensionScores: DiagnosisDimensionScore[];
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

    recommended.push({
      title: tool.title,
      whyRecommended: `Рекомендован, потому что у вас проседает контур «${
        dimensionLabelMap[matchedWeakDimension ?? ""] ?? "эта зона"
      }», а этот инструмент помогает ${
        (symptom?.reason ?? "навести базовую управляемость в проблемной зоне")
          .charAt(0)
          .toLowerCase() +
        (symptom?.reason ?? "навести базовую управляемость в проблемной зоне").slice(1)
      }.`,
    });

    if (recommended.length === 3) {
      break;
    }
  }

  return recommended;
}

function getWeakestZones(dimensionScores: DiagnosisDimensionScore[]) {
  return dimensionScores
    .slice()
    .sort((a, b) => a.averageScore - b.averageScore)
    .slice(0, 2)
    .map((item) => item.dimension);
}

function getStrongestZones(dimensionScores: DiagnosisDimensionScore[]) {
  return dimensionScores
    .slice()
    .sort((a, b) => b.averageScore - a.averageScore)
    .slice(0, 2)
    .map((item) => item.dimension);
}

export async function buildAiResultContextFromSession(
  sessionId: string,
): Promise<AiResultInterpretationContext | null> {
  const supabase = getSupabaseAdminClient();
  const { data: session, error: sessionError } = await supabase
    .from("diagnosis_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError || !session) {
    return null;
  }

  const { data: questions, error: questionsError } = await supabase
    .from("diagnosis_questions")
    .select("*")
    .eq("question_set_id", session.question_set_id)
    .order("order_index", { ascending: true, nullsFirst: false })
    .order("position", { ascending: true });

  const { data: answers, error: answersError } = await supabase
    .from("diagnosis_answers")
    .select("*")
    .eq("diagnosis_session_id", sessionId);

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("*")
    .eq("id", session.company_id)
    .maybeSingle();

  if (questionsError || answersError || companyError || !questions || !answers || !company) {
    return null;
  }

  const mappedQuestions = (questions as QuestionRow[]).map(mapQuestion);
  const mappedAnswers = (answers as AnswerRow[]).map(mapAnswer);
  const dimensionScores = calculateDimensionScores(mappedAnswers, mappedQuestions);
  const summary = buildDiagnosisSummary(mappedAnswers, mappedQuestions);
  const recommendedTools = await loadRecommendedTools({ dimensionScores });

  return {
    company: {
      id: company.id,
      name: company.name,
      industry: company.industry,
      teamSize: company.team_size,
      revenueRange: company.revenue_range,
      primaryGoal: company.primary_goal,
    },
    result: {
      sourceType: "live_result",
      sourceId: session.id,
      createdAt: session.completed_at ?? session.created_at,
      overallScore: session.total_score,
      summaryKey:
        session.summary_key === "low" || session.summary_key === "medium" || session.summary_key === "high"
          ? session.summary_key
          : summary.key,
      dimensionScores,
      weakestZones: getWeakestZones(dimensionScores),
      strongestZones: getStrongestZones(dimensionScores),
      summary,
      recommendedTools,
    },
  };
}

export async function buildAiResultContextFromSnapshot(
  snapshotId: string,
): Promise<AiResultInterpretationContext | null> {
  const supabase = getSupabaseAdminClient();
  const { data: snapshot, error: snapshotError } = await supabase
    .from("result_snapshots")
    .select("*")
    .eq("id", snapshotId)
    .maybeSingle();

  if (snapshotError || !snapshot) {
    return null;
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("*")
    .eq("id", (snapshot as ResultSnapshotRow).company_id)
    .maybeSingle();

  if (companyError || !company) {
    return null;
  }

  const parsedSummary = parseSummary((snapshot as ResultSnapshotRow).summary);

  return {
    company: {
      id: company.id,
      name: company.name,
      industry: company.industry,
      teamSize: company.team_size,
      revenueRange: company.revenue_range,
      primaryGoal: company.primary_goal,
    },
    result: {
      sourceType: "snapshot",
      sourceId: snapshot.id,
      createdAt: snapshot.created_at,
      overallScore: snapshot.overall_score,
      summaryKey: parsedSummary?.key ?? null,
      dimensionScores: parseDimensionScores(snapshot.dimension_scores),
      weakestZones: parseStringArray(snapshot.weakest_zones),
      strongestZones: parseStringArray(snapshot.strongest_zones),
      summary: parsedSummary,
      recommendedTools: parseRecommendedTools(snapshot.recommended_tools),
    },
  };
}
