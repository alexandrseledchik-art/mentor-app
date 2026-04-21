import { z } from "zod";

import { callOpenAiJson } from "@/lib/entry/openai-json";
import type { EntrySessionState } from "@/types/domain";

const askQuestionSchema = z.object({
  question: z.string().trim().min(1),
  whyThisQuestion: z.string().trim().min(1),
});

export type AskQuestionPayload = z.infer<typeof askQuestionSchema>;

const ASK_QUESTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    question: { type: "string" },
    whyThisQuestion: { type: "string" },
  },
  required: ["question", "whyThisQuestion"],
} as const;

const ASK_QUESTION_PROMPT = `Ты — business diagnostic intake assistant.

Тебе уже известно, что данных пока недостаточно для честного диагностического вывода.
Твоя задача — сформулировать ОДИН лучший вопрос, который сильнее всего уменьшит неопределённость.

Правила:
- только русский язык
- один вопрос, без меню
- вопрос должен быть коротким, понятным и деловым
- не предлагай варианты ответа списком
- вопрос должен помогать прояснить ровно один главный пробел данных: цель, симптом, факт, ограничение или контекст
- не задавай общий пустой вопрос вроде "расскажите подробнее"
- не спрашивай заново то, что пользователь уже явно сообщил
- сам определи по rawText и session, что уже известно, а чего не хватает
- не повторяй уже названную цель или уже перечисленные симптомы, если можно спросить точнее
- твой вопрос должен помогать отличить наиболее вероятные версии происходящего, а не просто собирать ещё текст
- думай от последовательности:
  1. что уже понятно;
  2. какой главный пробел данных остался;
  3. какой один ответ сильнее всего изменит следующий шаг
- если у пользователя уже есть цель, чаще уточняй препятствие, симптом, факт или ограничение, а не саму цель
- если вопрос можно задать конкретнее, не используй расплывчатые формулировки

Верни строго JSON.`;

export async function runAskQuestionGenerator(params: {
  rawText: string;
  session: EntrySessionState | null;
  routerReason: string;
}) {
  const result = await callOpenAiJson<AskQuestionPayload>({
    feature: "telegram_ask_question",
    systemPrompt: ASK_QUESTION_PROMPT,
    userPayload: {
      rawText: params.rawText,
      routerReason: params.routerReason,
      session: params.session
        ? {
            stage: params.session.stage,
            initialMessage: params.session.initialMessage,
            clarifyingAnswers: params.session.clarifyingAnswers.slice(-4),
            turnCount: params.session.turnCount,
          }
        : null,
    },
    schemaName: "telegram_ask_question",
    schema: ASK_QUESTION_JSON_SCHEMA,
    maxOutputTokens: 400,
    onErrorLabel: "ask_question_prompt",
  });

  return askQuestionSchema.parse(result);
}
