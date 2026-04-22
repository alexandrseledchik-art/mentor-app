import { z } from "zod";

import { callOpenAiJson } from "@/lib/entry/openai-json";
import type { EntrySessionState } from "@/types/domain";

const routerDecisionSchema = z.object({
  action: z.enum([
    "capability",
    "website_screening",
    "tool_navigation",
    "ask_question",
    "diagnostic_result",
  ]),
  confidence: z.enum(["low", "medium", "high"]),
  routerReason: z.string().trim().min(1),
});

export type RouterDecision = z.infer<typeof routerDecisionSchema>;

const ROUTER_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    action: {
      type: "string",
      enum: [
        "capability",
        "website_screening",
        "tool_navigation",
        "ask_question",
        "diagnostic_result",
      ],
    },
    confidence: {
      type: "string",
      enum: ["low", "medium", "high"],
    },
    routerReason: { type: "string" },
  },
  required: ["action", "confidence", "routerReason"],
} as const;

const ROUTER_PROMPT = `Ты — decision gate для Telegram-ассистента по бизнес-разбору.

Твоя задача:
определить ОДИН лучший следующий action для текущего сообщения пользователя.

Доступные action:
- capability
- website_screening
- tool_navigation
- ask_question
- diagnostic_result

Ты НЕ делаешь саму диагностику.
Ты НЕ пишешь длинный ответ пользователю.
Ты только решаешь, какой следующий ход сейчас честнее и полезнее всего.

Главные правила:
- отвечай только на русском
- не выдумывай факты
- не ставь диагноз, если сигнала недостаточно
- не подменяй диагностику инструментом, если пользователь всё ещё пытается понять бизнес-проблему
- ориентируйся на смысл запроса, а не только на отдельные слова
- если данных мало, выбирай ask_question
- ask_question означает: один ответ пользователя реально изменит следующий шаг
- website_screening — это только внешний разбор по сайту, без внутреннего диагноза бизнеса
- capability — это вопрос о возможностях бота, а не о бизнес-ситуации
- tool_navigation допустим только когда пользователь уже действительно готов идти в инструмент, а не когда ещё нужно понять ограничение
- diagnostic_result допустим только если выполнен порог достаточности сигнала
- если сомневаешься между ask_question и diagnostic_result, выбирай ask_question

Порог достаточности сигнала для diagnostic_result:
Нужно минимум 2 из 4:
- есть цель или желаемый результат;
- есть минимум 2 симптома текущей ситуации;
- есть минимум 1 факт / цифра / ограничение / наблюдение;
- есть понятный контекст бизнеса, роли или управленческой ситуации.

Если порог не выполнен, diagnostic_result выбирать нельзя.

Смысл action:
- capability: вопрос про возможности бота
- website_screening: по входу можно честно сделать только внешний скрининг сайта
- tool_navigation: лучший следующий шаг уже действительно инструмент
- ask_question: без одного ответа дальше будет либо имитация понимания, либо ложный диагноз
- diagnostic_result: сигнала уже достаточно для честного предварительного разбора в чате

Верни строго JSON.`;

export async function runEntryRouter(params: {
  rawText: string;
  session: EntrySessionState | null;
}) {
  const result = await callOpenAiJson<RouterDecision>({
    feature: "telegram_entry_router",
    systemPrompt: ROUTER_PROMPT,
    userPayload: {
      rawText: params.rawText,
      session: params.session
        ? {
            stage: params.session.stage,
            initialMessage: params.session.initialMessage,
            clarifyingAnswers: params.session.clarifyingAnswers.slice(-4),
            turnCount: params.session.turnCount,
          }
        : null,
    },
    schemaName: "telegram_entry_router",
    schema: ROUTER_JSON_SCHEMA,
    maxOutputTokens: 500,
    onErrorLabel: "router_prompt",
  });

  return routerDecisionSchema.parse(result);
}
