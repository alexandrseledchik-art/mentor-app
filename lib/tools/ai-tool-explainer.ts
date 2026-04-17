import "server-only";

import { logAiRouteEvent } from "@/lib/diagnosis/ai-route-utils";
import { aiToolExplanationResponseSchema } from "@/validators/diagnosis";

import type {
  AiToolExplanationResponse,
  ToolNavigationContext,
} from "@/types/domain";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

const AI_TOOL_EXPLAINER_SYSTEM_PROMPT = `Ты — архитектор бизнес-систем и навигатор по управленческим инструментам.

Твоя задача:
- объяснить, почему конкретный инструмент уместен по результату диагностики
- объяснить, какую проблему он помогает разобрать
- объяснить, где именно его применять
- объяснить, что подготовить до использования
- предупредить о типичных ошибках
- описать ожидаемый результат применения

Правила:
- не придумывай факты о компании сверх context
- не генерируй документ, шаблон или черновик инструмента
- не делай вид, что инструмент уже внедрён
- объясняй причинно: слабая зона -> зачем этот инструмент -> как подойти
- если данных мало, говори об этом прямо
- пиши практично и структурно, без мотивационного шума

Верни строго JSON:
{
  "whyThisTool": "...",
  "whatProblemItSolves": ["...", "..."],
  "whereToApply": ["...", "..."],
  "whatToPrepare": ["...", "..."],
  "commonMistakes": ["...", "..."],
  "expectedOutcome": "..."
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

function buildFallbackExplanation(
  context: ToolNavigationContext,
): AiToolExplanationResponse {
  const weakLead = context.result.weakestZones.slice(0, 2).join(" и ") || "ключевых слабых зон";

  return {
    whyThisTool: `Инструмент «${context.tool.title}» уместен, потому что результат указывает на ограничение в зоне ${weakLead}, а рекомендация уже связывает этот инструмент с этим узким местом.`,
    whatProblemItSolves: [
      "Помогает перевести слабую зону из абстрактной проблемы в конкретный предмет разбора.",
      "Помогает отделить корневую причину от симптомов и ручных компенсаций.",
    ],
    whereToApply: [
      "Используйте инструмент на том контуре, который сейчас даёт основной управленческий сбой.",
      "Разбирайте не бизнес целиком, а только тот участок, который прямо связан со слабой зоной результата.",
    ],
    whatToPrepare: [
      "Заранее зафиксируйте, где именно проблема проявляется сильнее всего.",
      "Соберите текущие факты, наблюдения и спорные зоны, а не предположения общего характера.",
    ],
    commonMistakes: [
      "Пытаться использовать инструмент сразу на всей компании вместо одного конкретного контура.",
      "Переходить к решениям слишком рано, не разобрав проблему и её механизм.",
    ],
    expectedOutcome: `На выходе должно стать понятнее, почему именно зона ${weakLead} ограничивает результат и какой следующий управленческий шаг логичен после разбора.`,
  };
}

function postProcessExplanation(
  raw: {
    whyThisTool?: unknown;
    whatProblemItSolves?: unknown;
    whereToApply?: unknown;
    whatToPrepare?: unknown;
    commonMistakes?: unknown;
    expectedOutcome?: unknown;
  },
  context: ToolNavigationContext,
) {
  const fallback = buildFallbackExplanation(context);

  return {
    whyThisTool:
      typeof raw.whyThisTool === "string" && raw.whyThisTool.trim().length > 0
        ? raw.whyThisTool.trim()
        : fallback.whyThisTool,
    whatProblemItSolves:
      trimStringArray(raw.whatProblemItSolves).slice(0, 4).length >= 2
        ? trimStringArray(raw.whatProblemItSolves).slice(0, 4)
        : fallback.whatProblemItSolves,
    whereToApply:
      trimStringArray(raw.whereToApply).slice(0, 4).length >= 2
        ? trimStringArray(raw.whereToApply).slice(0, 4)
        : fallback.whereToApply,
    whatToPrepare:
      trimStringArray(raw.whatToPrepare).slice(0, 4).length >= 2
        ? trimStringArray(raw.whatToPrepare).slice(0, 4)
        : fallback.whatToPrepare,
    commonMistakes:
      trimStringArray(raw.commonMistakes).slice(0, 4).length >= 2
        ? trimStringArray(raw.commonMistakes).slice(0, 4)
        : fallback.commonMistakes,
    expectedOutcome:
      typeof raw.expectedOutcome === "string" && raw.expectedOutcome.trim().length > 0
        ? raw.expectedOutcome.trim()
        : fallback.expectedOutcome,
  };
}

export async function generateAiToolExplanation(
  context: ToolNavigationContext,
): Promise<AiToolExplanationResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const temperature = Number(process.env.OPENAI_TEMPERATURE ?? "0.3");
  const maxOutputTokens = Number(process.env.OPENAI_MAX_TOKENS ?? "900");

  if (!apiKey) {
    logAiRouteEvent("tool_explainer_fallback_no_api_key", {
      toolSlug: context.tool.slug,
      sourceType: context.result.sourceType,
    });
    return buildFallbackExplanation(context);
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
        temperature: Number.isFinite(temperature) ? temperature : 0.3,
        max_output_tokens: Number.isFinite(maxOutputTokens) ? maxOutputTokens : 900,
        input: [
          {
            role: "system",
            content: AI_TOOL_EXPLAINER_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: JSON.stringify(context, null, 2),
          },
        ],
        metadata: {
          feature: "tool_navigation_explainer",
        },
        text: {
          format: {
            type: "json_schema",
            name: "tool_explanation",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                whyThisTool: { type: "string" },
                whatProblemItSolves: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
                whereToApply: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
                whatToPrepare: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
                commonMistakes: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
                expectedOutcome: { type: "string" },
              },
              required: [
                "whyThisTool",
                "whatProblemItSolves",
                "whereToApply",
                "whatToPrepare",
                "commonMistakes",
                "expectedOutcome",
              ],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      logAiRouteEvent("tool_explainer_http_error", {
        toolSlug: context.tool.slug,
        sourceType: context.result.sourceType,
      });
      return buildFallbackExplanation(context);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const text = getStructuredOutput(payload);

    if (!text) {
      logAiRouteEvent("tool_explainer_malformed_output_empty", {
        toolSlug: context.tool.slug,
      });
      return buildFallbackExplanation(context);
    }

    const json = JSON.parse(text) as {
      whyThisTool?: unknown;
      whatProblemItSolves?: unknown;
      whereToApply?: unknown;
      whatToPrepare?: unknown;
      commonMistakes?: unknown;
      expectedOutcome?: unknown;
    };

    const parsed = aiToolExplanationResponseSchema.safeParse(
      postProcessExplanation(json, context),
    );

    if (!parsed.success) {
      logAiRouteEvent("tool_explainer_parse_error", {
        toolSlug: context.tool.slug,
      });
      return buildFallbackExplanation(context);
    }

    return parsed.data;
  } catch (error) {
    logAiRouteEvent("tool_explainer_exception", {
      toolSlug: context.tool.slug,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return buildFallbackExplanation(context);
  }
}
