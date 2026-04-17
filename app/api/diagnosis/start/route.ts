import { NextResponse } from "next/server";

import { trackDiagnosisStarted } from "@/lib/analytics/diagnosis-analytics";
import { parseQuestionOptions } from "@/lib/diagnosis/mappers";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/workspace/get-current-app-user";
import { getOrCreateWorkspace } from "@/lib/workspace/get-or-create-workspace";
import { startOrResumeDiagnosis } from "@/lib/workspace/start-or-resume-diagnosis";
import diagnosisQuestionsSeed from "@/data/diagnosis-questions.express.ui.json";
import type {
  DiagnosisStartGetResponse,
  DiagnosisStartRequest,
  DiagnosisStartResponse,
} from "@/types/api";
import type { Database } from "@/types/db";
import type { DiagnosisQuestion, DiagnosisQuestionSet, DiagnosisSession } from "@/types/domain";
import {
  diagnosisStartGetResponseSchema,
  diagnosisStartRequestSchema,
  diagnosisStartResponseSchema,
} from "@/validators/diagnosis";

type QuestionSetRow = Database["public"]["Tables"]["diagnosis_question_sets"]["Row"];
type QuestionRow = Database["public"]["Tables"]["diagnosis_questions"]["Row"];
type SessionRow = Database["public"]["Tables"]["diagnosis_sessions"]["Row"];

type SeedQuestion = {
  question_code: string;
  question_text: string;
  dimension: string;
  options: Array<{
    level: number;
    label: string;
    text: string;
  }>;
  weight: number;
};

function buildStaticQuestionSet(): DiagnosisStartGetResponse {
  const seedQuestions = diagnosisQuestionsSeed as SeedQuestion[];

  return {
    questionSet: {
      id: "express_v1",
      code: "express_v1",
      title: "Экспресс диагностика",
      description: "Быстрая оценка состояния бизнеса",
      version: 1,
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    questions: seedQuestions.map((question, index) => ({
      id: question.question_code,
      questionSetId: "express_v1",
      code: question.question_code,
      title: question.question_text,
      questionText: question.question_text,
      dimension: question.dimension as DiagnosisQuestion["dimension"],
      position: index + 1,
      orderIndex: index + 1,
      inputType: "single_select",
      isRequired: true,
      options: question.options.map((option) => ({
        value: option.level,
        label: option.text,
      })),
      weight: question.weight,
      meta: {
        source: "express_static_fallback",
      },
      createdAt: new Date().toISOString(),
    })),
  };
}

function mapQuestionSet(row: QuestionSetRow): DiagnosisQuestionSet {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description ?? null,
    version: row.version,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

function mapQuestion(row: QuestionRow): DiagnosisQuestion {
  const meta =
    row.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
      ? (row.meta as Record<string, unknown>)
      : {};
  const fallbackOptions = Array.isArray(meta.options) ? meta.options : [];
  const fallbackWeight = typeof meta.weight === "number" ? meta.weight : 1;
  const parsedOptions = parseQuestionOptions(row.options);
  const parsedFallbackOptions = parseQuestionOptions(fallbackOptions);

  return {
    id: row.id,
    questionSetId: row.question_set_id,
    code: row.code,
    title: row.title ?? null,
    questionText: row.question_text ?? row.title,
    dimension: row.dimension as DiagnosisQuestion["dimension"],
    position: row.position ?? null,
    orderIndex: row.order_index ?? row.position,
    inputType: (row.input_type === "single_select" ? "single_select" : "scale"),
    isRequired: row.is_required,
    options: parsedOptions.length > 0 ? parsedOptions : parsedFallbackOptions,
    weight: row.weight ?? fallbackWeight,
    meta,
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

async function ensureExpressQuestionSet() {
  const supabase = getSupabaseAdminClient();

  const { data: existingQuestionSet, error: existingSetError } = await supabase
    .from("diagnosis_question_sets")
    .select("*")
    .eq("code", "express_v1")
    .maybeSingle();

  if (existingSetError) {
    throw existingSetError;
  }

  let questionSet = existingQuestionSet;

  if (!questionSet) {
    const createPayload = {
      code: "express_v1",
      title: "Экспресс диагностика",
      description: "Быстрая оценка состояния бизнеса",
      version: 1,
      is_active: true,
    };

    let createResult = await supabase
      .from("diagnosis_question_sets")
      .insert(createPayload)
      .select("*")
      .single();

    if (createResult.error) {
      createResult = await supabase
        .from("diagnosis_question_sets")
        .insert({
          code: "express_v1",
          title: "Экспресс диагностика",
          version: 1,
          is_active: true,
        })
        .select("*")
        .single();
    }

    if (createResult.error || !createResult.data) {
      throw createResult.error ?? new Error("Failed to create express question set.");
    }

    questionSet = createResult.data;
  }

  const { data: existingQuestions, error: existingQuestionsError } = await supabase
    .from("diagnosis_questions")
    .select("id")
    .eq("question_set_id", questionSet.id)
    .limit(1);

  if (existingQuestionsError) {
    throw existingQuestionsError;
  }

  if (!existingQuestions || existingQuestions.length === 0) {
    const seedQuestions = diagnosisQuestionsSeed as SeedQuestion[];

    let insertResult = await supabase
      .from("diagnosis_questions")
      .upsert(
        seedQuestions.map((question, index) => ({
          question_set_id: questionSet.id,
          code: question.question_code,
          title: question.question_text,
          question_text: question.question_text,
          dimension: question.dimension,
          position: index + 1,
          order_index: index + 1,
          input_type: "single_select",
          is_required: true,
          options: question.options.map((option) => ({
            value: option.level,
            label: option.text,
          })),
          weight: question.weight,
          meta: {
            source: "express_ui_seed_fallback",
          },
        })),
        { onConflict: "code" },
      );

    if (insertResult.error) {
      insertResult = await supabase
        .from("diagnosis_questions")
        .upsert(
          seedQuestions.map((question, index) => ({
            question_set_id: questionSet.id,
            code: question.question_code,
            title: question.question_text,
            dimension: question.dimension,
            position: index + 1,
            input_type: "single_select",
            is_required: true,
            meta: {
              source: "express_ui_seed_fallback",
              weight: question.weight,
              options: question.options.map((option) => ({
                value: option.level,
                label: option.text,
              })),
            },
          })),
          { onConflict: "code" },
        );
    }

    if (insertResult.error) {
      throw insertResult.error;
    }
  }

  return questionSet;
}

async function loadQuestionSet(code: string) {
  const supabase = getSupabaseAdminClient();
  await ensureExpressQuestionSet();

  const { data: questionSet, error: setError } = await supabase
    .from("diagnosis_question_sets")
    .select("*")
    .eq("code", code)
    .single();

  if (setError || !questionSet) {
    return { error: "Question set not found." as const };
  }

  let questionsResult = await supabase
    .from("diagnosis_questions")
    .select("*")
    .eq("question_set_id", questionSet.id)
    .order("order_index", { ascending: true, nullsFirst: false })
    .order("position", { ascending: true });

  if (questionsResult.error) {
    questionsResult = await supabase
      .from("diagnosis_questions")
      .select("*")
      .eq("question_set_id", questionSet.id)
      .order("position", { ascending: true });
  }

  const { data: questions, error: questionsError } = questionsResult;

  if (questionsError || !questions) {
    return { error: "Questions not found." as const };
  }

  return {
    questionSet: mapQuestionSet(questionSet),
    questions: questions.map(mapQuestion),
  };
}

export async function GET() {
  let result;

  try {
    result = await loadQuestionSet("express_v1");
  } catch (error) {
    console.error("DIAGNOSIS START GET ERROR:", error);
    const fallbackPayload = buildStaticQuestionSet();
    return NextResponse.json(diagnosisStartGetResponseSchema.parse(fallbackPayload));
  }

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  const payload: DiagnosisStartGetResponse = {
    questionSet: result.questionSet,
    questions: result.questions,
  };

  return NextResponse.json(diagnosisStartGetResponseSchema.parse(payload));
}

export async function POST(request: Request) {
  const body = (await request.json()) as DiagnosisStartRequest;
  const parsed = diagnosisStartRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid diagnosis start payload.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { companyId, questionSetCode = "express_v1" } = parsed.data;
  let questionSetResult;

  try {
    questionSetResult = await loadQuestionSet(questionSetCode);
  } catch (error) {
    console.error("DIAGNOSIS START POST ERROR:", error);
    return NextResponse.json({ error: "Failed to prepare diagnosis session." }, { status: 500 });
  }

  if ("error" in questionSetResult) {
    return NextResponse.json({ error: questionSetResult.error }, { status: 404 });
  }

  const supabase = getSupabaseAdminClient();
  const currentAppUser = await getCurrentAppUser();

  if (!currentAppUser) {
    return NextResponse.json({ error: "Пользователь не найден." }, { status: 401 });
  }

  const workspace = await getOrCreateWorkspace(currentAppUser.id);
  const resolvedCompanyId = workspace.activeCompanyId ?? companyId ?? null;

  if (!resolvedCompanyId) {
    return NextResponse.json(
      { error: "Компания не найдена. Вернитесь в онбординг и проверьте профиль компании." },
      { status: 404 },
    );
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id")
    .eq("id", resolvedCompanyId)
    .eq("user_id", currentAppUser.id)
    .maybeSingle();

  if (companyError || !company) {
    return NextResponse.json(
      { error: "Не удалось определить компанию для диагностики." },
      { status: 500 },
    );
  }

  let sessionResult;

  try {
    sessionResult = await startOrResumeDiagnosis({
      userId: currentAppUser.id,
      companyId: company.id,
      questionSetId: questionSetResult.questionSet.id,
    });
  } catch (error) {
    console.error("DIAGNOSIS START SESSION ERROR:", error);
    return NextResponse.json({ error: "Failed to create diagnosis session." }, { status: 500 });
  }

  const referer = request.headers.get("referer");
  let source: string | null = null;
  let entryMode: string | null = null;
  let entryIntent: string | null = null;

  if (referer) {
    try {
      const refererUrl = new URL(referer);
      source = refererUrl.searchParams.get("source");
      entryMode = refererUrl.searchParams.get("entry_mode");
      entryIntent = refererUrl.searchParams.get("entry_intent");
    } catch {
      source = null;
      entryMode = null;
      entryIntent = null;
    }
  }

  await trackDiagnosisStarted({
    userId: currentAppUser.id,
    companyId: company.id,
    diagnosisSessionId: sessionResult.session.id,
    questionSetId: questionSetResult.questionSet.id,
    resumed: sessionResult.resumed,
    source,
    entryMode,
    entryIntent,
  });

  const payload: DiagnosisStartResponse = {
    session: sessionResult.session,
    questionSet: questionSetResult.questionSet,
    questions: questionSetResult.questions,
  };

  return NextResponse.json(diagnosisStartResponseSchema.parse(payload), {
    status: sessionResult.resumed ? 200 : 201,
  });
}
