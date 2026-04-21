import { z } from "zod";

import { callOpenAiJson } from "@/lib/entry/openai-json";
import { POST_WEBSITE_SCREENING_REQUEST_TEXT } from "@/lib/entry/constants";
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
- не превращай ответ в длинный список, если достаточно 4–8 коротких абзацев/блоков
- если structured JSON частично пустой, не проговаривай отсутствующие разделы

Правила:
- если action = capability, ответь прямо и коротко, строго опираясь на capabilityFacts
- если action = website_screening, собери ответ как внешний скрининг: не диагноз бизнеса, а видимое снаружи и возврат в чат
- если action = ask_question, коротко зафиксируй, что уже понято, и задай один лучший вопрос
- если action = tool_navigation, коротко объясни, почему инструмент — правильный следующий шаг именно сейчас
- если action = diagnostic_result, сделай плотный Telegram-friendly разбор без вида "консалтингового отчёта"
- при слабом или средне-слабом сигнале делай ответ компактнее: не перечисляй пустые или слабые секции
- не дублируй все поля JSON текстом
- не перечисляй всё, если это не усиливает следующий шаг
- финальный акцент всегда на лучшем следующем шаге
- не придумывай ограничения возможностей бота, которых нет в capabilityFacts
- если capabilityFacts говорят, что голосовые принимаются через распознавание, не пиши, что бот понимает только текст
- для website_screening держи только такую логику:
  1. обозначь, что это внешний скрининг сайта, а не диагноз бизнеса;
  2. скажи, что видно снаружи;
  3. назови сильные стороны;
  4. назови, что стоит проверить;
  5. назови, что нельзя утверждать по сайту;
  6. верни пользователя в чат блоком:
     Что дальше:
     {websiteScreeningRequestText}
     Напишите запрос в 1–2 фразах.
- для website_screening не придумывай отдельные советы, приоритеты или "лучший следующий шаг" вне этой логики
- для diagnostic_result не расписывай все секции автоматически; показывай только то, что действительно усиливает понимание и следующий шаг

Верни только replyText в JSON.`;

export async function runReplyRenderer(params: {
  action: "capability" | "website_screening" | "tool_navigation" | "ask_question" | "diagnostic_result";
  rawText: string;
  routerReason: string;
  question?: {
    text: string;
    whyThisQuestion: string;
  } | null;
  capabilityFacts?: string[] | null;
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
    userPayload: {
      ...params,
      websiteScreeningRequestText: POST_WEBSITE_SCREENING_REQUEST_TEXT,
    },
    schemaName: "telegram_reply_renderer",
    schema: RENDERED_REPLY_JSON_SCHEMA,
    maxOutputTokens: 1100,
    onErrorLabel: "reply_renderer_prompt",
  });

  return renderedReplySchema.parse(result);
}
