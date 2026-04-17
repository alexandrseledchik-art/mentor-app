import { NextResponse } from "next/server";

import { classifyHeuristicBundle } from "@/lib/recommendations/bundles";
import { buildHybridRecommendation } from "@/lib/recommendations/orchestrate";
import {
  buildDiagnosisSummary,
  calculateDimensionScores,
} from "@/lib/diagnosis/summary";
import { generateDiagnosisAiSummary } from "@/lib/diagnosis/ai-summary";
import { parseQuestionOptions } from "@/lib/diagnosis/mappers";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { DiagnosisResultResponse } from "@/types/api";
import type { Database } from "@/types/db";
import type {
  DiagnosisAnswerInput,
  Company,
  DiagnosisAiSummary,
  DiagnosisQuestion,
  DiagnosisQuestionSet,
  RecommendedTool,
  ResultRecommendedTool,
  DiagnosisSummaryContext,
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
type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];

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

  const orderedMappings = mappings as SymptomToolMapRow[];
  const dimensionOrder = new Map(
    weakestDimensions.map((item, index) => [dimensionSectionMap[item.dimension], index]),
  );
  const orderedSymptoms = (symptoms as SymptomRow[]).slice().sort((a, b) => {
    const aIndex = dimensionOrder.get(a.section) ?? 999;
    const bIndex = dimensionOrder.get(b.section) ?? 999;
    return aIndex - bIndex;
  });
  const orderedSymptomIds = orderedSymptoms.map((item) => item.id);
  const toolIds = Array.from(new Set(orderedMappings.map((item) => item.tool_id)));
  const { data: tools, error: toolsError } = await supabase
    .from("tools")
    .select("*")
    .in("id", toolIds);

  if (toolsError || !tools?.length) {
    return [];
  }

  const toolById = new Map((tools as ToolRow[]).map((tool) => [tool.id, tool]));
  const symptomOrder = new Map(orderedSymptomIds.map((id, index) => [id, index]));
  const sortedMappings = orderedMappings.slice().sort((a, b) => {
    const aSymptomOrder = symptomOrder.get(a.symptom_id) ?? 999;
    const bSymptomOrder = symptomOrder.get(b.symptom_id) ?? 999;

    if (aSymptomOrder !== bSymptomOrder) {
      return aSymptomOrder - bSymptomOrder;
    }

    return a.priority - b.priority;
  });
  const recommended: RecommendedTool[] = [];

  for (const mapping of sortedMappings) {
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
        `Рекомендован, потому что у вас проседает контур «${
          dimensionLabelMap[
            weakestDimensions.find((item) => dimensionSectionMap[item.dimension] === symptom?.section)
              ?.dimension ?? ""
          ] ?? "эта зона"
        }», а этот инструмент помогает ${
          (symptom?.reason ?? "навести базовую управляемость в проблемной зоне").charAt(0).toLowerCase() +
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

function buildSummaryContext(params: {
  dimensionScores: Array<{ dimension: string; averageScore: number }>;
  summary: DiagnosisResultResponse["summary"];
  tools: RecommendedTool[];
  company: Company | null;
}): DiagnosisSummaryContext {
  const sortedScores = params.dimensionScores.slice().sort((a, b) => a.averageScore - b.averageScore);
  const weakestDomains = sortedScores
    .filter((item) => item.averageScore <= 2)
    .map((item) => item.dimension);
  const strongestDomains = params.dimensionScores
    .slice()
    .sort((a, b) => b.averageScore - a.averageScore)
    .slice(0, 2)
    .map((item) => item.dimension);

  return {
    weakestDomains,
    strongestDomains,
    topProblems: params.summary.risks,
    recommendedTools: params.tools.map((tool) => ({
      title: tool.title,
      whyRecommended: tool.whyRecommended,
    })),
    company: params.company
      ? {
          id: params.company.id,
          name: params.company.name,
          industry: params.company.industry,
          teamSize: params.company.teamSize,
          revenueRange: params.company.revenueRange,
          primaryGoal: params.company.primaryGoal,
        }
      : null,
  };
}

function buildScores(dimensionScores: Array<{ dimension: string; averageScore: number }>) {
  const scoreByDimension = new Map(dimensionScores.map((item) => [item.dimension, item.averageScore]));

  return {
    owner: scoreByDimension.get("owner") ?? null,
    market: scoreByDimension.get("external_environment") ?? null,
    strategy: scoreByDimension.get("strategy") ?? null,
    product: scoreByDimension.get("product") ?? null,
    sales: scoreByDimension.get("commercial") ?? null,
    operations: scoreByDimension.get("operations") ?? null,
    finance: scoreByDimension.get("finance") ?? null,
    team: scoreByDimension.get("team") ?? null,
    management: scoreByDimension.get("governance") ?? null,
    tech: scoreByDimension.get("technology") ?? null,
    data: scoreByDimension.get("data") ?? null,
  };
}

function buildFallbackChatSummary(params: {
  summary: DiagnosisResultResponse["summary"];
  summaryContext: DiagnosisSummaryContext;
  dimensionScores: Array<{ dimension: string; averageScore: number }>;
}) {
  const sortedScores = params.dimensionScores.slice().sort((a, b) => a.averageScore - b.averageScore);
  const weakestLabel =
    dimensionLabelMap[sortedScores[0]?.dimension ?? ""] ?? "ключевой контур управления";
  const strongestLabels = params.summaryContext.strongestDomains
    .slice(0, 2)
    .map((item) => dimensionLabelMap[item] ?? item);
  const whyNowBase =
    params.summary.risks.length >= 3
      ? params.summary.risks.slice(0, 3)
      : [
          `${weakestLabel} сейчас тянет управление назад → решения становятся медленнее и дороже.`,
          `Пока этот контур не выровнен → рост остаётся менее предсказуемым.`,
          `Если оставить всё как есть → команда и собственник будут продолжать тушить последствия вручную.`,
        ];

  return {
    mainSummary: `${params.summary.title}. ${params.summary.description}`,
    mainFocus: `Сначала выровняйте контур «${weakestLabel}».`,
    whyNow: whyNowBase,
    strengths:
      strongestLabels.length >= 2
        ? strongestLabels.map(
            (item) => `${item} уже дают опору, поэтому изменения можно проводить быстрее.`,
          )
        : [
            "В бизнесе уже есть рабочие элементы системы, поэтому изменения не нужно начинать с нуля.",
            "Даже частичная управляемость даёт опору, а значит быстрые улучшения уже реалистичны.",
          ],
    firstSteps: [
      `Сегодня зафиксируйте, где именно контур «${weakestLabel}» сильнее всего тормозит решения.`,
      "Назначьте одного владельца за разбор проблемы и срок первого результата.",
      "Через короткий цикл проверьте эффект и закрепите новый управленческий ритм.",
    ],
  };
}

function buildRecommendationContext(params: {
  company: Company | null;
  dimensionScores: Array<{ dimension: string; averageScore: number }>;
  summary: DiagnosisResultResponse["summary"];
  summaryContext: DiagnosisSummaryContext;
  aiSummary: DiagnosisAiSummary | null;
}) {
  const summary = params.aiSummary ?? buildFallbackChatSummary({
    summary: params.summary,
    summaryContext: params.summaryContext,
    dimensionScores: params.dimensionScores,
  });

  return {
    company: params.company
      ? {
          name: params.company.name,
          industry: params.company.industry,
          teamSize: params.company.teamSize,
          revenue: params.company.revenueRange,
          goal: params.company.primaryGoal,
        }
      : null,
    scores: buildScores(params.dimensionScores),
    summary: {
      main_summary: summary.mainSummary,
      main_focus: summary.mainFocus,
      why_now: summary.whyNow,
      strengths: summary.strengths,
      first_steps: summary.firstSteps,
    },
  };
}

function getResultScenarioCandidates(bundle: ReturnType<typeof classifyHeuristicBundle>["bundle"]) {
  const candidatesByBundle = {
    owner_governance: [
      { mode: "risk", selectedPath: "owner_overload" },
      { mode: "start", selectedPath: "decisions" },
      { mode: "growth", selectedPath: "decisions" },
    ],
    commercial_product: [
      { mode: "growth", selectedPath: "sales" },
      { mode: "growth", selectedPath: "product" },
      { mode: "risk", selectedPath: "growth_slowdown" },
    ],
    operations_governance: [
      { mode: "risk", selectedPath: "loss_of_control" },
      { mode: "start", selectedPath: "cadence" },
      { mode: "growth", selectedPath: "decisions" },
    ],
    strategy_market: [
      { mode: "start", selectedPath: "strategy" },
      { mode: "risk", selectedPath: "growth_slowdown" },
      { mode: "growth", selectedPath: "product" },
    ],
    mixed: [
      { mode: "growth", selectedPath: "sales" },
      { mode: "risk", selectedPath: "loss_of_control" },
      { mode: "start", selectedPath: "strategy" },
    ],
  } as const;

  return candidatesByBundle[bundle];
}

async function loadResultRecommendedTools(params: {
  company: Company | null;
  dimensionScores: Array<{ dimension: string; averageScore: number }>;
  summary: DiagnosisResultResponse["summary"];
  summaryContext: DiagnosisSummaryContext;
  aiSummary: DiagnosisAiSummary | null;
  fallbackTools: RecommendedTool[];
}) {
  const recommendationContext = buildRecommendationContext({
    company: params.company,
    dimensionScores: params.dimensionScores,
    summary: params.summary,
    summaryContext: params.summaryContext,
    aiSummary: params.aiSummary,
  });
  const bundle = classifyHeuristicBundle({
    ...recommendationContext,
    mode: "growth",
    selectedPath: "sales",
  }).bundle;
  const candidates = getResultScenarioCandidates(bundle);

  const results = await Promise.all(
    candidates.map((candidate) =>
      buildHybridRecommendation({
        ...recommendationContext,
        mode: candidate.mode,
        selectedPath: candidate.selectedPath,
      }),
    ),
  );

  const personalizedTools: ResultRecommendedTool[] = [];

  for (const result of results) {
    const handoff = result.hybridRecommendation?.toolHandoff ?? null;
    const toolContext = handoff?.toolContext ?? null;

    if (!handoff || !toolContext) {
      continue;
    }

    if (
      personalizedTools.some(
        (item) => item.title.trim().toLowerCase() === handoff.tool.title.trim().toLowerCase(),
      )
    ) {
      continue;
    }

    personalizedTools.push({
      title: handoff.tool.title,
      whyNow: toolContext.whyThisToolNow,
      whatItClarifies: toolContext.whatItClarifies,
      source: "hybrid",
    });

    if (personalizedTools.length === 3) {
      break;
    }
  }

  if (personalizedTools.length > 0) {
    return personalizedTools;
  }

  return params.fallbackTools.slice(0, 3).map((tool) => ({
    title: tool.title,
    whyNow: tool.whyRecommended,
    whatItClarifies: tool.summary,
    source: "deterministic" as const,
  }));
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

  const [
    { data: questionSet, error: setError },
    { data: questions, error: questionsError },
    { data: answers, error: answersError },
    { data: company },
  ] =
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
      supabase
        .from("companies")
        .select("*")
        .eq("id", session.company_id)
        .maybeSingle(),
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
  const summary = buildDiagnosisSummary(mappedAnswers, mappedQuestions);
  const mappedCompany = company ? mapCompany(company as CompanyRow) : null;
  const summaryContext = buildSummaryContext({
    dimensionScores,
    summary,
    tools: recommendedTools,
    company: mappedCompany,
  });
  const aiSummary = await generateDiagnosisAiSummary(summaryContext, dimensionScores);
  const resultRecommendedTools = await loadResultRecommendedTools({
    company: mappedCompany,
    dimensionScores,
    summary,
    summaryContext,
    aiSummary,
    fallbackTools: recommendedTools,
  });
  const payload: DiagnosisResultResponse = {
    questionSet: mapQuestionSet(questionSet),
    questions: mappedQuestions,
    session: mapSession(session),
    answers: mappedAnswers,
    dimensionScores,
    summary,
    tools: recommendedTools,
    resultRecommendedTools,
    summaryContext,
    aiSummary,
  };

  return NextResponse.json(diagnosisResultResponseSchema.parse(payload));
}
