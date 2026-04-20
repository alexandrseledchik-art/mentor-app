import { z } from "zod";

import { callOpenAiJson } from "@/lib/entry/openai-json";
import type { DiagnosticStructuredResult } from "@/lib/diagnostic-core/schema";
import type { WebsiteScreeningResult } from "@/lib/website/website-screening";

const renderedReplySchema = z.object({
  replyText: z.string().trim().min(1),
});

type RenderedReply = z.infer<typeof renderedReplySchema>;

const RENDERED_REPLY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    replyText: { type: "string" },
  },
  required: ["replyText"],
} as const;

const RENDERER_PROMPT = `Ты — renderer Telegram-ответа.

Твоя задача:
по structured JSON собрать финальный replyText для пользователя.

Требования:
- только русский язык
- коротко
- структурно
- без воды
- без длинной теории
- без повторов structured JSON
- без ложной уверенности
- звучит как Telegram-ответ, а не как тяжёлый консалтинговый отчёт

Правила:
- если action = capability, ответь прямо и коротко
- если action = website_screening, коротко покажи:
  - что видно снаружи
  - что стоит проверить
  - что нельзя утверждать
  - один следующий шаг
- если action = ask_question, коротко зафиксируй, что уже понято, и задай один лучший вопрос
- если action = tool_navigation, коротко объясни, почему это правильный следующий шаг
- если action = diagnostic_result, дай плотный Telegram-friendly разбор:
  - цель и симптомы
  - 1–2 ключевые гипотезы
  - главное ограничение
  - первая волна
  - что не делать сейчас
  - короткий вывод
- не дублируй все поля JSON текстом
- не перечисляй всё, если это не усиливает следующий шаг
- финальный акцент всегда на лучшем следующем шаге

Верни только replyText в JSON.`;

export async function runReplyRenderer(params: {
  action: "capability" | "website_screening" | "tool_navigation" | "ask_question" | "diagnostic_result";
  rawText: string;
  routerReason: string;
  question?: {
    text: string;
    whyThisQuestion: string;
  } | null;
  tool?: {
    slug: string;
    title: string;
    reason: string;
  } | null;
  websiteScreening?: WebsiteScreeningResult | null;
  diagnosticResult?: DiagnosticStructuredResult | null;
}) {
  const result = await callOpenAiJson<RenderedReply>({
    feature: "telegram_reply_renderer",
    systemPrompt: RENDERER_PROMPT,
    userPayload: params,
    schemaName: "telegram_reply_renderer",
    schema: RENDERED_REPLY_JSON_SCHEMA,
    maxOutputTokens: 1100,
    onErrorLabel: "reply_renderer_prompt",
  });

  return renderedReplySchema.parse(result);
}
