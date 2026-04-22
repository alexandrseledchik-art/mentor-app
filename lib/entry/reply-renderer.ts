import { z } from "zod";

import { callOpenAiJson } from "@/lib/entry/openai-json";
import { POST_WEBSITE_SCREENING_REQUEST_TEXT } from "@/lib/entry/constants";
import {
  hasFormalAssistantPhrasing,
  normalizeReplyText,
} from "@/lib/entry/reply-normalizer";
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

const RENDERER_PROMPT = `Ты — не support-бот и не корпоративный ассистент.
Ты собираешь финальный Telegram-ответ сильного бизнес-диагноста.

Твоя задача:
по structured JSON собрать финальный replyText так, чтобы он звучал живо, жёстко и по делу.

Требования:
- только русский язык
- коротко
- без воды
- без длинной теории
- без ложной уверенности
- звучит как живой Telegram-ответ, а не как тяжёлый консалтинговый отчёт
- не превращай ответ в длинный список, если достаточно 1–4 коротких абзацев
- если structured JSON частично пустой, не проговаривай отсутствующие разделы
- каждый ответ должен добавить новую ценность: framing, ограничение, гипотезу или точный следующий шаг
- ответ, который только пересказывает пользователя, считается плохим

Правила:
- если action = capability, ответь прямо и коротко, строго опираясь на capabilityFacts; не добавляй универсальный CTA в конце
- если action = website_screening, собери ответ как внешний скрининг: не диагноз бизнеса, а видимое снаружи и развилка, что разбирать дальше
- если action = ask_question, сначала дай сильную рамку или гипотезу, потом задай один точный вопрос
- если action = tool_navigation, коротко объясни, почему инструмент — правильный следующий шаг именно сейчас
- если action = diagnostic_result, сделай плотный Telegram-friendly разбор без вида "консалтингового отчёта"
- при слабом или средне-слабом сигнале делай ответ компактнее: не перечисляй пустые или слабые секции
- не дублируй все поля JSON текстом
- не перечисляй всё, если это не усиливает следующий шаг
- финальный акцент всегда на лучшем следующем шаге
- не начинай сообщение с "Понял", "Понимаю", "Вижу", "Привет", "Здравствуйте"
- вообще не используй конструкцию "Вы хотите ..."
- вообще не используй конструкцию "Чтобы помочь ..."
- не используй бюрократические формулы вроде "это важный шаг", "уточните запрос", "продолжим разбор"
- если action = ask_question, не повторяй одно и то же резюме цели на каждом ходе; используй только тот минимум контекста, который помогает понять, зачем задан именно этот вопрос
- если пользователь уже сказал, что не знает точных цифр, не заставляй replyText снова просить те же цифры; лучше перенеси фокус на наблюдаемый барьер или симптом
- не придумывай ограничения возможностей бота, которых нет в capabilityFacts
- если capabilityFacts говорят, что голосовые принимаются через распознавание, не пиши, что бот понимает только текст
- чаще формулируй через:
  - "Значит задача сейчас..."
  - "Похоже, упирается в..."
  - "Сейчас развилка в том..."
  - "Обычно здесь ломается одно из трёх..."
  - "Тогда смотреть нужно сюда..."
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
- если action != website_screening, не используй блок "Что дальше:" и не вставляй фразу "{websiteScreeningRequestText}"

Верни только replyText в JSON.`;

const RENDERER_REPAIR_PROMPT = `${RENDERER_PROMPT}

Твоя первая версия была слишком формальной или слишком похожей на support-бота.
Пересобери ответ жёстче и живее.

Дополнительные запреты:
- не пересказывай формулой "Вы хотите..."
- не вставляй "Чтобы помочь..."
- не используй универсальный хвост "Что дальше" вне website_screening
- если мысль можно сказать короче и сильнее, скажи короче и сильнее`;

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
  const userPayload = {
    ...params,
    websiteScreeningRequestText:
      params.action === "website_screening" ? POST_WEBSITE_SCREENING_REQUEST_TEXT : null,
  };

  const firstResult = await callOpenAiJson<RenderedReply>({
    feature: "telegram_reply_renderer",
    systemPrompt: RENDERER_PROMPT,
    userPayload,
    schemaName: "telegram_reply_renderer",
    schema: RENDERED_REPLY_JSON_SCHEMA,
    maxOutputTokens: 1100,
    onErrorLabel: "reply_renderer_prompt",
  });

  let parsed = renderedReplySchema.parse(firstResult);
  let normalizedText = normalizeReplyText({
    action: params.action,
    text: parsed.replyText,
  });

  if (
    hasFormalAssistantPhrasing({
      action: params.action,
      text: normalizedText,
    })
  ) {
    const repaired = await callOpenAiJson<RenderedReply>({
      feature: "telegram_reply_renderer",
      systemPrompt: RENDERER_REPAIR_PROMPT,
      userPayload: {
        ...userPayload,
        previousReplyText: normalizedText,
      },
      schemaName: "telegram_reply_renderer_repair",
      schema: RENDERED_REPLY_JSON_SCHEMA,
      maxOutputTokens: 1100,
      onErrorLabel: "reply_renderer_repair_prompt",
    });

    parsed = renderedReplySchema.parse(repaired);
    normalizedText = normalizeReplyText({
      action: params.action,
      text: parsed.replyText,
    });
  }

  return renderedReplySchema.parse({
    replyText: normalizedText,
  });
}
