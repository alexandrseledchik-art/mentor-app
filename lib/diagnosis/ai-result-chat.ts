import "server-only";

import { logAiRouteEvent } from "@/lib/diagnosis/ai-route-utils";
import { aiResultChatResponseSchema } from "@/validators/diagnosis";

import type {
  AiHistoryInterpretationContext,
  AiResultChatRequest,
  AiResultChatResponse,
  AiResultInterpretationContext,
} from "@/types/domain";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

const AI_RESULT_CHAT_SYSTEM_PROMPT = `Ты — архитектор бизнес-систем, который объясняет результат диагностики.

Ты отвечаешь только на основе resultContext и, если он передан, historyContext.

Правила:
- не придумывай данные
- не пересчитывай баллы
- не выдавай историю как точный тренд, если данных мало
- если вопрос про динамику, а historyContext пуст или слишком короткий, скажи об этом прямо
- если вопрос требует точных чисел, а их нет в context, прямо скажи об отсутствии данных
- не утверждай конкретные количественные изменения, если они не переданы явно
- отделяй наблюдение из context от интерпретации
- отвечай коротко, точно и управленчески

Верни строго JSON:
{
  "reply": "...",
  "suggestedFollowups": ["...", "..."]
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

function buildSuggestedFollowups(hasHistory: boolean) {
  return hasHistory
    ? ["В чём главный риск?", "С чего начать?", "Какой тренд вы видите?"]
    : ["В чём главный риск?", "С чего начать?", "На что можно опереться?"];
}

function buildFallbackAnswer(params: {
  question: string;
  resultContext?: AiResultInterpretationContext | null;
  historyContext?: AiHistoryInterpretationContext | null;
}): AiResultChatResponse {
  const question = params.question.trim().toLowerCase();
  const resultContext = params.resultContext;
  const historyContext = params.historyContext;

  if (!resultContext) {
    return {
      reply: "Сейчас мне не хватает самого результата диагностики, чтобы ответить предметно.",
      suggestedFollowups: buildSuggestedFollowups(Boolean(historyContext?.history.length)),
    };
  }

  if (
    question.includes("точн") ||
    question.includes("сколько") ||
    question.includes("точный") ||
    question.includes("точная")
  ) {
    return {
      reply: "У меня нет права придумывать точные значения сверх того, что есть в результате. Если в контексте нет точного числа, я лучше не буду его выдумывать.",
      suggestedFollowups: buildSuggestedFollowups(Boolean(historyContext?.history.length)),
    };
  }

  if (question.includes("выручк") || question.includes("revenue")) {
    return {
      reply:
        resultContext.company.revenueRange
          ? `В результате есть только диапазон выручки: ${resultContext.company.revenueRange}. Точного значения в контексте нет.`
          : "В текущем контексте нет точного значения выручки, поэтому я не буду его додумывать.",
      suggestedFollowups: buildSuggestedFollowups(Boolean(historyContext?.history.length)),
    };
  }

  if (question.includes("команд") && (question.includes("сколько") || question.includes("размер"))) {
    return {
      reply:
        resultContext.company.teamSize
          ? `В контексте есть только размерный диапазон команды: ${resultContext.company.teamSize}. Точного количества сотрудников здесь нет.`
          : "В текущем контексте нет точного размера команды, поэтому я не буду его выдумывать.",
      suggestedFollowups: buildSuggestedFollowups(Boolean(historyContext?.history.length)),
    };
  }

  const weakestLead = resultContext.result.weakestZones.slice(0, 2).join(" и ") || "ключевой слабый контур";
  const strongestLead = resultContext.result.strongestZones[0] ?? "сильная зона";
  const firstTool = resultContext.result.recommendedTools[0]?.title ?? "первый рекомендованный инструмент";
  const summaryTitle = resultContext.result.summary?.title ?? "результат диагностики";

  if (question.includes("главн") && question.includes("риск")) {
    return {
      reply: `Главный риск сейчас в том, что слабая зона ${weakestLead} будет и дальше тянуть назад решения, исполнение и скорость изменений.`,
      suggestedFollowups: buildSuggestedFollowups(Boolean(historyContext?.history.length)),
    };
  }

  if (question.includes("с чего начать") || question.includes("начать")) {
    return {
      reply: `Начинать лучше с самого слабого контура — ${weakestLead}. Первый практический шаг: открыть инструмент «${firstTool}» и разобрать не симптомы, а корневое ограничение.`,
      suggestedFollowups: buildSuggestedFollowups(Boolean(historyContext?.history.length)),
    };
  }

  if (question.includes("узк") || question.includes("бутыл") || question.includes("огранич")) {
    return {
      reply: `Главное ограничение сейчас проходит через ${weakestLead}. Именно там система сильнее всего теряет управляемость и темп.`,
      suggestedFollowups: buildSuggestedFollowups(Boolean(historyContext?.history.length)),
    };
  }

  if (
    question.includes("что измен") ||
    question.includes("динамик") ||
    question.includes("тренд") ||
    question.includes("по сравнению")
  ) {
    if (!historyContext || historyContext.history.length < 2) {
      return {
        reply: "Для уверенного вывода о динамике нужна хотя бы одна предыдущая завершённая диагностика. Сейчас у меня недостаточно исторических снимков, чтобы честно описать тренд.",
        suggestedFollowups: buildSuggestedFollowups(false),
      };
    }

    const first = historyContext.history[0];
    const last = historyContext.history[historyContext.history.length - 1];
    const direction =
      typeof first.overallScore === "number" && typeof last.overallScore === "number"
        ? last.overallScore > first.overallScore
          ? "есть осторожный положительный сдвиг"
          : last.overallScore < first.overallScore
            ? "видно ухудшение общей управляемости"
            : "сильного сдвига по общему баллу не видно"
        : "количественный тренд выражен слабо";

    return {
      reply: `По истории ${direction}. При этом это именно интерпретация тренда по снимкам: важно смотреть, смещаются ли слабые зоны и стал ли контур решений/исполнения более устойчивым.`,
      suggestedFollowups: buildSuggestedFollowups(true),
    };
  }

  if (question.includes("сильн") || question.includes("оперет")) {
    return {
      reply: `Сильнее всего сейчас можно опереться на ${strongestLead}. Это не снимает ограничение в зоне ${weakestLead}, но даёт платформу для ближайших изменений.`,
      suggestedFollowups: buildSuggestedFollowups(Boolean(historyContext?.history.length)),
    };
  }

  return {
    reply: `${summaryTitle}: главный узкий участок сейчас в ${weakestLead}. Опора есть в зоне ${strongestLead}. Ближайший разумный шаг — перевести вывод в один конкретный разбор через «${firstTool}».`,
    suggestedFollowups: buildSuggestedFollowups(Boolean(historyContext?.history.length)),
  };
}

export async function answerAiResultQuestion(params: {
  question: string;
  resultContext?: AiResultInterpretationContext | null;
  historyContext?: AiHistoryInterpretationContext | null;
}): Promise<AiResultChatResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const temperature = Number(process.env.OPENAI_TEMPERATURE ?? "0.3");
  const maxOutputTokens = Number(process.env.OPENAI_MAX_TOKENS ?? "900");

  if (!apiKey) {
    logAiRouteEvent("chat_fallback_no_api_key", {
      sourceType: params.resultContext?.result.sourceType ?? "unknown",
    });
    return buildFallbackAnswer(params);
  }

  try {
    const requestPayload: AiResultChatRequest = {
      question: params.question,
    };

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
            content: AI_RESULT_CHAT_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                question: requestPayload.question,
                resultContext: params.resultContext ?? null,
                historyContext:
                  params.historyContext && params.historyContext.history.length > 0
                    ? params.historyContext
                    : null,
              },
              null,
              2,
            ),
          },
        ],
        metadata: {
          feature: "diagnosis_ai_result_chat",
        },
        text: {
          format: {
            type: "json_schema",
            name: "ai_result_chat",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                reply: { type: "string" },
                suggestedFollowups: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 0,
                  maxItems: 4,
                },
              },
              required: ["reply", "suggestedFollowups"],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      logAiRouteEvent("chat_llm_http_error", {
        sourceType: params.resultContext?.result.sourceType ?? "unknown",
      });
      return buildFallbackAnswer(params);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const text = getStructuredOutput(payload);

    if (!text) {
      logAiRouteEvent("chat_malformed_output_empty", {
        sourceType: params.resultContext?.result.sourceType ?? "unknown",
      });
      return buildFallbackAnswer(params);
    }

    const json = JSON.parse(text) as {
      reply?: unknown;
      suggestedFollowups?: unknown;
    };

    const parsed = aiResultChatResponseSchema.safeParse({
      reply: typeof json.reply === "string" ? json.reply.trim() : "",
      suggestedFollowups: Array.isArray(json.suggestedFollowups)
        ? json.suggestedFollowups
        : buildSuggestedFollowups(Boolean(params.historyContext?.history.length)),
    });

    if (!parsed.success) {
      logAiRouteEvent("chat_malformed_output_parse", {
        sourceType: params.resultContext?.result.sourceType ?? "unknown",
      });
      return buildFallbackAnswer(params);
    }

    return parsed.data;
  } catch (error) {
    logAiRouteEvent("chat_llm_exception", {
      sourceType: params.resultContext?.result.sourceType ?? "unknown",
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return buildFallbackAnswer(params);
  }
}
