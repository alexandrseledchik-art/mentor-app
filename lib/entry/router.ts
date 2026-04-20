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

const ROUTER_PROMPT = `Ты — router для Telegram-ассистента по бизнес-разбору.

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
Ты только:
- понимаешь тип запроса;
- оцениваешь достаточность сигнала;
- выбираешь лучший следующий шаг;
- коротко объясняешь логику выбора.

Главные правила:
- отвечай только на русском
- не выдумывай факты
- не ставь диагноз, если сигнала недостаточно
- не подменяй диагностику инструментом, если пользователь всё ещё описывает бизнес-проблему
- если есть только сайт или почти только сайт, это website_screening
- если пользователь спрашивает о возможностях бота, это capability
- если пользователь явно просит инструмент, но одновременно описывает боль бизнеса, сначала оцени, хватает ли сигнала для диагностики; если проблема ещё не понята, выбирай ask_question или diagnostic_result, а не tool_navigation
- если данных мало, выбирай ask_question и ориентируйся на один лучший следующий вопрос
- не задавай menu-style вопросов без необходимости
- diagnostic_result допустим только если выполнен порог достаточности сигнала

Порог достаточности сигнала для diagnostic_result:
Нужно минимум 2 из 4:
- есть цель или желаемый результат;
- есть минимум 2 симптома текущей ситуации;
- есть минимум 1 факт / цифра / ограничение / наблюдение;
- есть понятный контекст бизнеса, роли или управленческой ситуации.

Если порог не выполнен, diagnostic_result выбирать нельзя.

Правила выбора:
- capability: вопрос о том, что бот умеет, принимает ли голосовые, понимает ли картинки, анализирует ли сайт
- website_screening: только сайт, почти только сайт, или сайт + слишком слабая боль, которой недостаточно для внутреннего диагноза
- tool_navigation: пользователь пришёл именно за инструментом, а не за пониманием ограничения
- ask_question: данных недостаточно для честного разбора
- diagnostic_result: сигнала уже достаточно для предварительного, но честного диагностического разбора

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
