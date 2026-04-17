import { NextResponse } from "next/server";

import { generateDiagnosisChatReply } from "@/lib/diagnosis/ai-chat";
import { parseQuestionOptions } from "@/lib/diagnosis/mappers";
import {
  buildDiagnosisSummary,
  calculateDimensionScores,
} from "@/lib/diagnosis/summary";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { DiagnosisChatResponse } from "@/types/api";
import type { Database } from "@/types/db";
import type {
  Company,
  DiagnosisAiSummary,
  DiagnosisAnswerInput,
  DiagnosisChatContext,
  DiagnosisDimensionScore,
  DiagnosisQuestion,
  RecommendedTool,
} from "@/types/domain";
import {
  diagnosisChatRequestSchema,
  diagnosisChatResponseSchema,
} from "@/validators/diagnosis";

type SessionRow = Database["public"]["Tables"]["diagnosis_sessions"]["Row"];
type QuestionRow = Database["public"]["Tables"]["diagnosis_questions"]["Row"];
type AnswerRow = Database["public"]["Tables"]["diagnosis_answers"]["Row"];
type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
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
  const recommended: RecommendedTool[] = [];

  for (const mapping of mappings as SymptomToolMapRow[]) {
    const tool = toolById.get(mapping.tool_id);
    const symptom = symptomById.get(mapping.symptom_id);

    if (!tool || recommended.some((item) => item.id === tool.id)) {
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

function buildSummaryContext(params: {
  dimensionScores: DiagnosisDimensionScore[];
  summary: ReturnType<typeof buildDiagnosisSummary>;
  tools: RecommendedTool[];
  company: Company | null;
}) {
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

function buildScores(dimensionScores: DiagnosisDimensionScore[]) {
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

function buildFallbackSummary(params: {
  summary: ReturnType<typeof buildDiagnosisSummary>;
  summaryContext: ReturnType<typeof buildSummaryContext>;
  dimensionScores: DiagnosisDimensionScore[];
}): DiagnosisAiSummary {
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

function buildChatContext(params: {
  company: Company | null;
  dimensionScores: DiagnosisDimensionScore[];
  summary: ReturnType<typeof buildDiagnosisSummary>;
  summaryContext: ReturnType<typeof buildSummaryContext>;
}): DiagnosisChatContext {
  const aiSummary = buildFallbackSummary({
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
      main_summary: aiSummary.mainSummary,
      main_focus: aiSummary.mainFocus,
      why_now: aiSummary.whyNow,
      strengths: aiSummary.strengths,
      first_steps: aiSummary.firstSteps,
    },
  };
}

export async function POST(request: Request) {
  const body = await request.json();
  console.error("DIAGNOSIS CHAT PAYLOAD:", body);
  const parsed = diagnosisChatRequestSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Некорректный запрос чата.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { sessionId, message, mode, step, selectedPath } = parsed.data;
  const { data: session, error: sessionError } = await supabase
    .from("diagnosis_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Сессия диагностики не найдена." }, { status: 404 });
  }

  const [
    { data: questions, error: questionsError },
    { data: answers, error: answersError },
    { data: company },
  ] = await Promise.all([
    supabase
      .from("diagnosis_questions")
      .select("*")
      .eq("question_set_id", (session as SessionRow).question_set_id)
      .order("order_index", { ascending: true, nullsFirst: false })
      .order("position", { ascending: true }),
    supabase
      .from("diagnosis_answers")
      .select("*")
      .eq("diagnosis_session_id", sessionId),
    supabase
      .from("companies")
      .select("*")
      .eq("id", (session as SessionRow).company_id)
      .maybeSingle(),
  ]);

  if (questionsError || !questions) {
    return NextResponse.json({ error: "Вопросы диагностики не найдены." }, { status: 404 });
  }

  if (answersError || !answers) {
    return NextResponse.json({ error: "Ответы диагностики не найдены." }, { status: 404 });
  }

  const mappedQuestions = questions.map(mapQuestion);
  const mappedAnswers = answers.map(mapAnswer);
  const dimensionScores = calculateDimensionScores(mappedAnswers, mappedQuestions);
  const summary = buildDiagnosisSummary(mappedAnswers, mappedQuestions);
  const mappedCompany = company ? mapCompany(company as CompanyRow) : null;
  const recommendedTools = await loadRecommendedTools({ dimensionScores });
  const summaryContext = buildSummaryContext({
    dimensionScores,
    summary,
    tools: recommendedTools,
    company: mappedCompany,
  });
  const chatContext = buildChatContext({
    company: mappedCompany,
    dimensionScores,
    summary,
    summaryContext,
  });
  console.error("DIAGNOSIS CHAT CONTEXT:", JSON.stringify(chatContext, null, 2));
  console.error(
    "DIAGNOSIS CHAT MODEL INPUT:",
    JSON.stringify(
      {
        context: chatContext,
        question: message,
        mode: mode ?? null,
        step: step ?? null,
        selected_path: selectedPath ?? null,
      },
      null,
      2,
    ),
  );
  const reply = await generateDiagnosisChatReply({
    context: chatContext,
    question: message,
    mode,
    step,
    selectedPath,
  });

  if (!reply) {
    return NextResponse.json(
      {
        error: "Не удалось загрузить разбор результата. Попробуйте ещё раз.",
      },
      { status: 503 },
    );
  }

  const payload: DiagnosisChatResponse = {
    reply: reply.reply,
    context: chatContext,
  };
  console.error("DIAGNOSIS CHAT RESPONSE:", JSON.stringify(payload, null, 2));

  return NextResponse.json(diagnosisChatResponseSchema.parse(payload));
}
