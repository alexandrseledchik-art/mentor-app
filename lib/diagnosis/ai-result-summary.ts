import "server-only";

import { logAiRouteEvent } from "@/lib/diagnosis/ai-route-utils";
import { getOpenAiModel, getOpenAiNumberEnv } from "@/lib/openai/model-config";
import { aiResultSummaryResponseSchema } from "@/validators/diagnosis";

import type {
  AiResultInterpretationContext,
  AiResultSummaryResponse,
} from "@/types/domain";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

const AI_RESULT_SUMMARY_SYSTEM_PROMPT = `Ты — архитектурный интерпретатор результата бизнес-диагностики.

Ты работаешь только с тем структурированным контекстом, который тебе передан.

Твоя задача:
- объяснить результат по-деловому
- выделить главное ограничение системы
- показать сильные зоны как опоры
- выделить 2-4 приоритета
- предложить 2-4 следующих шага

Правила:
- не придумывай данные вне контекста
- не пересчитывай оценки
- не переписывай deterministic result
- если каких-то данных нет в context, прямо скажи, что данных нет
- не выводи точные числа, дельты или количественные изменения, если они не переданы явно
- отделяй наблюдаемое в context от своей интерпретации
- если в context нет исторической информации, не делай выводов о тренде
- не говори абстрактно и мотивационно
- пиши как для собственника и управленческой команды

Формат ответа строго JSON:
{
  "narrative": "...",
  "priorities": ["...", "..."],
  "risks": ["...", "..."],
  "strengths": ["...", "..."],
  "nextSteps": ["...", "..."]
}`;

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

function trimStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function buildFallbackSummary(
  context: AiResultInterpretationContext,
): AiResultSummaryResponse {
  const weakestLead = context.result.weakestZones.slice(0, 2).join(" и ") || "ключевом управленческом контуре";
  const strongestLead = context.result.strongestZones.slice(0, 2);
  const toolLead = context.result.recommendedTools[0]?.title ?? "первый рекомендованный инструмент";

  return {
    narrative:
      context.result.summary?.description
        ? `${context.result.summary.description} Главный системный узкий участок сейчас находится в ${weakestLead}.`
        : `Главное ограничение сейчас находится в ${weakestLead}, и именно оно сильнее всего тормозит управляемость и скорость изменений.`,
    priorities: [
      `Сначала выровнять контур «${context.result.weakestZones[0] ?? "ключевая слабая зона"}».`,
      "Отделить корневое ограничение от накопившихся симптомов и ручных компенсаций.",
      "Привязать первый управленческий шаг к одному конкретному инструменту и одному контуру изменений.",
    ].slice(0, 3),
    risks: [
      `Если не выровнять ${weakestLead}, решения и исполнение останутся менее предсказуемыми.`,
      "Ручное управление будет продолжать маскировать причину проблемы, а не устранять её.",
      context.result.summary?.risks[0] ??
        "Слабый контур будет и дальше тянуть назад рост, управляемость или прибыль.",
    ].slice(0, 3),
    strengths:
      strongestLead.length > 0
        ? strongestLead.map((item) => `Зона «${item}» уже может служить опорой для ближайших изменений.`)
        : [
            "В системе уже есть рабочие элементы, на которые можно опереться при следующем шаге.",
            "Изменения не нужно строить с нуля — важнее собрать правильный первый управленческий цикл.",
          ],
    nextSteps: [
      `Сначала подтвердите, что именно в зоне «${context.result.weakestZones[0] ?? "приоритета"}» является корнем проблемы.`,
      `Затем откройте инструмент «${toolLead}» и переведите вывод в конкретный рабочий разбор.`,
      "После первого цикла проверьте, усилилась ли управляемость именно в слабом контуре, а не только симптомах.",
    ].slice(0, 3),
  };
}

function postProcessSummary(
  raw: {
    narrative?: unknown;
    priorities?: unknown;
    risks?: unknown;
    strengths?: unknown;
    nextSteps?: unknown;
  },
  context: AiResultInterpretationContext,
) {
  const fallback = buildFallbackSummary(context);

  return {
    narrative:
      typeof raw.narrative === "string" && raw.narrative.trim().length > 0
        ? raw.narrative.trim()
        : fallback.narrative,
    priorities:
      trimStringArray(raw.priorities).slice(0, 4).length >= 2
        ? trimStringArray(raw.priorities).slice(0, 4)
        : fallback.priorities,
    risks:
      trimStringArray(raw.risks).slice(0, 4).length >= 2
        ? trimStringArray(raw.risks).slice(0, 4)
        : fallback.risks,
    strengths:
      trimStringArray(raw.strengths).slice(0, 4).length >= 2
        ? trimStringArray(raw.strengths).slice(0, 4)
        : fallback.strengths,
    nextSteps:
      trimStringArray(raw.nextSteps).slice(0, 4).length >= 2
        ? trimStringArray(raw.nextSteps).slice(0, 4)
        : fallback.nextSteps,
  };
}

export async function generateAiResultSummary(
  context: AiResultInterpretationContext,
): Promise<AiResultSummaryResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = getOpenAiModel();
  const temperature = getOpenAiNumberEnv("OPENAI_TEMPERATURE", 0.3);
  const maxOutputTokens = getOpenAiNumberEnv("OPENAI_MAX_TOKENS", 900);

  if (!apiKey) {
    logAiRouteEvent("summary_fallback_no_api_key", {
      sourceType: context.result.sourceType,
    });
    return buildFallbackSummary(context);
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
            content: AI_RESULT_SUMMARY_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: JSON.stringify(context, null, 2),
          },
        ],
        metadata: {
          feature: "diagnosis_ai_result_summary",
        },
        text: {
          format: {
            type: "json_schema",
            name: "ai_result_summary",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                narrative: { type: "string" },
                priorities: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
                risks: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
                strengths: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
                nextSteps: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
              },
              required: ["narrative", "priorities", "risks", "strengths", "nextSteps"],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      logAiRouteEvent("summary_llm_http_error", {
        sourceType: context.result.sourceType,
      });
      return buildFallbackSummary(context);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const text = getStructuredOutput(payload);

    if (!text) {
      logAiRouteEvent("summary_malformed_output_empty", {
        sourceType: context.result.sourceType,
      });
      return buildFallbackSummary(context);
    }

    const json = JSON.parse(text) as {
      narrative?: unknown;
      priorities?: unknown;
      risks?: unknown;
      strengths?: unknown;
      nextSteps?: unknown;
    };

    const parsed = aiResultSummaryResponseSchema.safeParse(
      postProcessSummary(json, context),
    );

    if (!parsed.success) {
      logAiRouteEvent("summary_malformed_output_parse", {
        sourceType: context.result.sourceType,
      });
      return buildFallbackSummary(context);
    }

    return parsed.data;
  } catch (error) {
    logAiRouteEvent("summary_llm_exception", {
      sourceType: context.result.sourceType,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return buildFallbackSummary(context);
  }
}
