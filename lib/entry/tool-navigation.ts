import { z } from "zod";

import { callOpenAiJson } from "@/lib/entry/openai-json";

const toolNavigationSchema = z.object({
  toolSlug: z.string().trim().min(1).nullable(),
  toolTitle: z.string().trim().min(1).nullable(),
  reason: z.string().trim().min(1),
});

export type ToolNavigationPayload = z.infer<typeof toolNavigationSchema>;

const TOOL_NAVIGATION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    toolSlug: { type: ["string", "null"] },
    toolTitle: { type: ["string", "null"] },
    reason: { type: "string" },
  },
  required: ["toolSlug", "toolTitle", "reason"],
} as const;

const TOOL_NAVIGATION_PROMPT = `Ты — decision helper для выбора следующего инструмента в Telegram-ассистенте.

Тебе уже известно, что лучший следующий action — tool_navigation.
Твоя задача — выбрать инструмент только из переданного каталога.

Правила:
- только русский язык
- не придумывай инструменты вне каталога
- если точного и уверенного совпадения нет, верни toolSlug = null и toolTitle = null
- reason должен кратко объяснять, почему инструмент подходит или почему точного совпадения нет
- ориентируйся на смысл запроса, а не только на совпадение слов
- выбирай инструмент только тогда, когда пользовательский запрос уже действительно про инструмент или ближайшее практическое действие
- если по смыслу запрос всё ещё больше про понимание проблемы, чем про сам инструмент, лучше верни null/null
- не веди себя как каталог или FAQ: инструмент здесь — следствие уже понятной задачи

Верни строго JSON.`;

export async function runToolNavigationResolver(params: {
  rawText: string;
  toolsCatalog: Array<{
    slug: string;
    title: string;
    summary: string;
  }>;
}) {
  const result = await callOpenAiJson<ToolNavigationPayload>({
    feature: "telegram_tool_navigation",
    systemPrompt: TOOL_NAVIGATION_PROMPT,
    userPayload: {
      rawText: params.rawText,
      toolsCatalog: params.toolsCatalog,
    },
    schemaName: "telegram_tool_navigation",
    schema: TOOL_NAVIGATION_JSON_SCHEMA,
    maxOutputTokens: 500,
    onErrorLabel: "tool_navigation_prompt",
  });

  return toolNavigationSchema.parse(result);
}
