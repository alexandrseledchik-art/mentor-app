import { z } from "zod";

import { isCapabilityQuestion } from "@/lib/entry/capability-questions";
import { getOpenAiModel, getOpenAiNumberEnv } from "@/lib/openai/model-config";
import { hasUrl, stripUrls } from "@/lib/url-utils";
import type { EntrySessionState } from "@/types/domain";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

const coreEntryConsultantSchema = z.object({
  mode: z.enum([
    "capability",
    "website_screening",
    "tool_navigation",
    "ask_question",
    "diagnostic_intake",
    "diagnostic_result",
  ]),
  confidence: z.enum(["low", "medium", "high"]),
  understanding: z.string().trim().min(1),
  question: z.string().trim().min(1).nullable().optional(),
  rationale: z.string().trim().min(1),
});

type CoreEntryConsultantResponse = z.infer<typeof coreEntryConsultantSchema>;

const CORE_ENTRY_CONSULTANT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    mode: {
      type: "string",
      enum: [
        "capability",
        "website_screening",
        "tool_navigation",
        "ask_question",
        "diagnostic_intake",
        "diagnostic_result",
      ],
    },
    confidence: {
      type: "string",
      enum: ["low", "medium", "high"],
    },
    understanding: { type: "string" },
    question: { type: ["string", "null"] },
    rationale: { type: "string" },
  },
  required: ["mode", "confidence", "understanding", "rationale"],
} as const;

const CORE_ENTRY_CONSULTANT_PROMPT = `Ты — независимый senior business consultant и бизнес-диагност.

Твоя задача на входе Telegram — не строить сложный state machine, а честно понять запрос и выбрать ОДИН лучший следующий шаг.

Ты должен решить, какой это режим:
- capability: пользователь спрашивает о возможностях бота, а не просит разбирать бизнес
- website_screening: пользователь дал только ссылку или почти только ссылку, поэтому можно сделать только внешний скрининг
- tool_navigation: пользователь явно просит инструмент или способ решения, и следующий шаг — подобрать/открыть инструмент
- ask_question: данных пока мало, и нужен один лучший уточняющий вопрос
- diagnostic_intake: сигнала уже хватает для короткого intake-разбора, но ещё рано делать полноценный диагностический вывод
- diagnostic_result: сигнала уже хватает для короткого предварительного диагноза в Telegram

Правила:
- отвечай только на русском
- не придумывай факты
- если это capability-вопрос, не запускай диагностику
- если это только URL без бизнес-контекста, не делай диагноз бизнеса
- если данных мало, задай один лучший вопрос, который уменьшит неопределённость
- если данные уже достаточно сильные, можно идти в diagnostic_result
- не используй menu-style вопросы ради шаблона; вопрос должен помогать понять цель, симптом или развести гипотезы
- будь плотным, спокойным и консультативным

Верни строго JSON по схеме.`;

function getStructuredOutput(response: Record<string, unknown>) {
  const outputText = response.output_text;

  if (typeof outputText === "string" && outputText.trim().length > 0) {
    return outputText;
  }

  const output = response.output;

  if (!Array.isArray(output)) {
    return null;
  }

  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const content = (item as { content?: unknown }).content;

    if (!Array.isArray(content)) {
      continue;
    }

    for (const part of content) {
      if (!part || typeof part !== "object") {
        continue;
      }

      const text = (part as { text?: unknown }).text;

      if (typeof text === "string" && text.trim().length > 0) {
        return text;
      }
    }
  }

  return null;
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s?]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countSignals(text: string) {
  const normalized = normalize(stripUrls(text));
  const markers = [
    "продажи",
    "лиды",
    "конверс",
    "хаос",
    "собственник",
    "прозрач",
    "касс",
    "маржа",
    "прибыль",
    "процесс",
    "команд",
    "не покупают",
    "сделк",
    "неупак",
    "оценк",
    "ручн",
  ];

  return markers.filter((marker) => normalized.includes(marker)).length;
}

function buildFallbackQuestion(rawText: string) {
  const normalized = normalize(stripUrls(rawText));

  if (normalized.includes("продать бизнес")) {
    return "Чтобы продолжить по делу, уточните в 1–2 фразах: что сейчас сильнее всего мешает продаже — непрозрачные цифры, зависимость от собственника, нестабильные продажи или неупакованность бизнеса для сделки?";
  }

  if (normalized.includes("продажи") || normalized.includes("лиды") || normalized.includes("конверс")) {
    return "Чтобы не перепутать симптом с причиной, уточните в 1–2 фразах: сейчас сильнее всего проседают лиды, конверсия, сам оффер или исполнение продаж?";
  }

  return "Чтобы продолжить разбор по делу, уточните в 1–2 фразах: какого результата вы хотите и что сейчас сильнее всего этому мешает?";
}

function looksLikeToolRequest(text: string) {
  const normalized = normalize(text);

  return [
    "инструмент",
    "шаблон",
    "матрица",
    "чеклист",
    "raci",
    "swot",
    "kpi",
    "okr",
    "юнит экономика",
    "юнит экономик",
    "воронка",
    "cash gap",
  ].some((marker) => normalized.includes(marker));
}

function buildFallbackResponse(params: {
  rawText: string;
  session: EntrySessionState | null;
}): CoreEntryConsultantResponse {
  const trimmed = params.rawText.trim();
  const normalized = normalize(trimmed);
  const onlyUrl = hasUrl(trimmed) && stripUrls(trimmed).trim().length === 0;
  const signalCount = countSignals(trimmed);
  const clarifyingCount = params.session?.clarifyingAnswers.length ?? 0;
  const activeUnknown = params.session?.activeUnknown;

  if (isCapabilityQuestion(trimmed)) {
    return {
      mode: "capability",
      confidence: "high",
      understanding: "Понял, это вопрос о возможностях бота, а не запрос на бизнес-разбор.",
      rationale: "Для capability-вопроса не нужен диагностический маршрут.",
    };
  }

  if (onlyUrl) {
    return {
      mode: "website_screening",
      confidence: "medium",
      understanding: "Вижу, что вы прислали только ссылку. По одной ссылке честно можно сделать только внешний скрининг сайта, оффера и пути пользователя.",
      rationale: "URL без бизнес-контекста не даёт основания для внутреннего диагноза бизнеса.",
    };
  }

  if (looksLikeToolRequest(trimmed)) {
    return {
      mode: "tool_navigation",
      confidence: "medium",
      understanding: "Похоже, вы уже ищете не общий разбор, а конкретный инструмент или ближайший способ решения.",
      rationale: "На таком входе лучше сначала подобрать точный инструмент, а не запускать общий диагностический маршрут.",
    };
  }

  if (
    signalCount >= 3 &&
    clarifyingCount >= 1 &&
    activeUnknown !== "goal" &&
    activeUnknown !== "main_symptom" &&
    activeUnknown !== "hypothesis_split"
  ) {
    return {
      mode: "diagnostic_result",
      confidence: "medium",
      understanding: "Сигнала уже хватает для короткого предварительного диагноза в Telegram.",
      rationale: "Есть понятная цель или контекст запроса и уже достаточно симптомов, чтобы перейти от intake к предварительному ограничению.",
    };
  }

  if (signalCount >= 2) {
    return {
      mode: "diagnostic_intake",
      confidence: "medium",
      understanding: "Сигнала уже хватает для короткого intake-разбора, но ещё рано делать жёсткий диагностический вывод.",
      rationale: "Есть опорные сигналы по ситуации, но они ещё требуют аккуратной сборки в диагностическую рамку.",
    };
  }

  return {
    mode: "ask_question",
    confidence: "low",
    understanding: normalized.length > 0
      ? "Понял общий вектор запроса, но пока данных недостаточно для честного вывода."
      : "Пока не вижу самого запроса.",
    question: buildFallbackQuestion(trimmed),
    rationale: "На этом этапе один уточняющий вопрос даст больше пользы, чем преждевременный разбор.",
  };
}

export async function runCoreEntryConsultant(params: {
  rawText: string;
  session: EntrySessionState | null;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = getOpenAiModel();
  const temperature = getOpenAiNumberEnv("OPENAI_TEMPERATURE", 0.2);
  const maxOutputTokens = getOpenAiNumberEnv("OPENAI_MAX_TOKENS", 700);

  const input = {
    rawText: params.rawText,
    session: params.session
      ? {
          stage: params.session.stage,
          initialMessage: params.session.initialMessage,
          clarifyingAnswers: params.session.clarifyingAnswers.slice(-3),
          conversationFrame: params.session.conversationFrame,
          activeUnknown: params.session.activeUnknown,
          turnCount: params.session.turnCount,
        }
      : null,
  };

  if (!apiKey) {
    return buildFallbackResponse(params);
  }

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature,
        max_output_tokens: maxOutputTokens,
        input: [
          {
            role: "system",
            content: CORE_ENTRY_CONSULTANT_PROMPT,
          },
          {
            role: "user",
            content: JSON.stringify(input, null, 2),
          },
        ],
        metadata: {
          feature: "entry_core_consultant",
        },
        text: {
          format: {
            type: "json_schema",
            name: "core_entry_consultant",
            strict: true,
            schema: CORE_ENTRY_CONSULTANT_JSON_SCHEMA,
          },
        },
      }),
    });

    if (!response.ok) {
      console.error("ENTRY_CORE_CONSULTANT_HTTP_ERROR", {
        status: response.status,
      });
      return buildFallbackResponse(params);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const text = getStructuredOutput(payload);

    if (!text) {
      console.error("ENTRY_CORE_CONSULTANT_EMPTY_OUTPUT");
      return buildFallbackResponse(params);
    }

    return coreEntryConsultantSchema.parse(JSON.parse(text));
  } catch (error) {
    console.error("ENTRY_CORE_CONSULTANT_FALLBACK", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return buildFallbackResponse(params);
  }
}

export type { CoreEntryConsultantResponse };
