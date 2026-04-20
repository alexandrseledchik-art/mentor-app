import "server-only";

import { appendCaseMessage } from "@/lib/cases/append-case-message";
import { completePreliminaryScreening } from "@/lib/cases/complete-preliminary-screening";
import { createCase } from "@/lib/cases/create-case";
import { buildCaseDeepLink } from "@/lib/cases/deeplink";
import { getActiveCompanyContextForCase } from "@/lib/cases/get-active-company-context";
import { buildDiagnosisDeepLink } from "@/lib/entry/deeplink";
import {
  POST_WEBSITE_SCREENING_REQUEST_TEXT,
} from "@/lib/entry/constants";
import { getOpenAiModel, getOpenAiNumberEnv } from "@/lib/openai/model-config";
import { getOrCreateTelegramAppUser } from "@/lib/telegram/app-user";
import {
  extractWebsiteContextFromText,
  type WebsiteContext,
} from "@/lib/website/extract-website-context";
import type { TelegramEntryReply } from "@/types/domain";
import { z } from "zod";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const websiteScreeningResultSchema = z.object({
  observedPositioning: z.string().trim().min(1),
  visibleStrengths: z.array(z.string().trim().min(1)).min(1).max(4),
  possibleRiskAreas: z
    .array(
      z.object({
        area: z.string().trim().min(1),
        whyCheck: z.string().trim().min(1),
      }),
    )
    .min(1)
    .max(5),
  cannotConclude: z.array(z.string().trim().min(1)).min(1).max(4),
});

type WebsiteScreeningResult = z.infer<typeof websiteScreeningResultSchema>;

const WEBSITE_SCREENING_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    observedPositioning: { type: "string" },
    visibleStrengths: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: { type: "string" },
    },
    possibleRiskAreas: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          area: { type: "string" },
          whyCheck: { type: "string" },
        },
        required: ["area", "whyCheck"],
      },
    },
    cannotConclude: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: { type: "string" },
    },
  },
  required: [
    "observedPositioning",
    "visibleStrengths",
    "possibleRiskAreas",
    "cannotConclude",
  ],
} as const;

const WEBSITE_SCREENING_SYSTEM_PROMPT = `Ты — business systems triage advisor.

Пользователь дал только сайт. Твоя задача — сделать внешний скрининг сайта, а не диагностику бизнеса.

Жёсткие правила:
- весь ответ пиши только на русском языке
- даже если сайт, оффер, заголовки и описание на английском, объясняй выводы только на русском
- не называй главное ограничение бизнеса
- не делай выводы о финансах, команде, внутренних процессах или управленческом учёте, если это не сказано прямо на сайте
- отделяй то, что видно на сайте, от того, что стоит проверить
- не превращай скрининг в полный консалтинг-отчёт
- не предлагай автоматизацию как вывод по умолчанию
- если сайт описывает продукт/сервис, анализируй видимый оффер и путь пользователя, а не "болезни" самой компании
- не формулируй следующий вопрос пользователю, это делает продуктовый сценарий

Формат ответа строго JSON по схеме.`;

function countMatches(text: string, pattern: RegExp) {
  return (text.match(pattern) ?? []).length;
}

function containsTooMuchLatin(text: string) {
  const latinCount = countMatches(text, /[A-Za-z]/g);
  const cyrillicCount = countMatches(text, /[А-Яа-яЁё]/g);

  return latinCount >= 40 && latinCount > cyrillicCount;
}

function shouldUseRussianFallback(result: WebsiteScreeningResult) {
  const combined = [
    result.observedPositioning,
    ...result.visibleStrengths,
    ...result.possibleRiskAreas.flatMap((item) => [item.area, item.whyCheck]),
    ...result.cannotConclude,
  ].join(" ");

  return containsTooMuchLatin(combined);
}

function describeVisibleTheme(context: WebsiteContext | null) {
  const title = context?.title?.trim();
  const description = context?.description?.trim();
  const heading = context?.headings[0]?.trim();
  const primarySignal = description || heading;

  if (title && !containsTooMuchLatin(title)) {
    if (primarySignal && !containsTooMuchLatin(primarySignal)) {
      return `По внешнему виду и тексту сайт позиционируется вокруг темы: ${title}. Видимый смысл: ${primarySignal}.`;
    }

    return `По внешнему виду и тексту сайт позиционируется вокруг темы: ${title}.`;
  }

  if (primarySignal && !containsTooMuchLatin(primarySignal)) {
    return `По внешнему виду и тексту сайт позиционируется вокруг следующего оффера: ${primarySignal}.`;
  }

  return "По внешнему виду и тексту сайт показывает понятный внешний оффер, но по одной ссылке можно сделать только предварительный внешний скрининг.";
}

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

function buildFallbackWebsiteScreening(context: WebsiteContext | null): WebsiteScreeningResult {
  return {
    observedPositioning: describeVisibleTheme(context),
    visibleStrengths: [
      "Пользователь может быстро понять основной оффер по первому экрану.",
      "Сайт даёт достаточно внешнего контекста для первичного скрининга позиционирования.",
    ],
    possibleRiskAreas: [
      {
        area: "Доверие к обещанию",
        whyCheck: "Если обещан быстрый результат, важно показать, на чём основан вывод и где границы уверенности.",
      },
      {
        area: "Следующий шаг после первичного результата",
        whyCheck: "Стоит проверить, понятно ли пользователю, что делать после получения первого вывода.",
      },
    ],
    cannotConclude: [
      "Нельзя определить реальное главное ограничение бизнеса только по сайту.",
      "Нельзя оценить финансы, команду, операционные процессы и управленческий учёт без внутренних данных.",
    ],
  };
}

function formatWebsiteScreeningReply(params: {
  result: WebsiteScreeningResult;
  caseUrl: string;
}): TelegramEntryReply {
  const { result, caseUrl } = params;
  const riskLines = result.possibleRiskAreas
    .slice(0, 4)
    .map((item) => `- ${item.area}: ${item.whyCheck}`)
    .join("\n");

  return {
    text: [
      "Сделал внешний скрининг сайта. Это не диагноз бизнеса: по одной ссылке нельзя честно определить внутреннее ограничение.",
      `Что видно снаружи: ${result.observedPositioning}`,
      `Сильные стороны:\n${result.visibleStrengths.slice(0, 3).map((item) => `- ${item}`).join("\n")}`,
      `Что стоит проверить:\n${riskLines}`,
      `Что нельзя утверждать по сайту:\n${result.cannotConclude.slice(0, 3).map((item) => `- ${item}`).join("\n")}`,
      [
        "По одной ссылке я могу сделать только внешний скрининг: что видно по сайту, офферу и пути пользователя.",
        `Что дальше:\n${POST_WEBSITE_SCREENING_REQUEST_TEXT}\nНапишите запрос в 1–2 фразах.`,
      ].join("\n\n"),
    ].join("\n\n"),
    cta: {
      label: "Открыть сохранённый скрининг",
      url: caseUrl,
    },
    stage: "clarifying",
  };
}

function buildWebsiteScreeningMarkdown(result: WebsiteScreeningResult) {
  return [
    "## Что видно снаружи",
    result.observedPositioning,
    "## Сильные стороны",
    result.visibleStrengths.map((item) => `- ${item}`).join("\n"),
    "## Что стоит проверить",
    result.possibleRiskAreas
      .map((item) => `- ${item.area}: ${item.whyCheck}`)
      .join("\n"),
    "## Что нельзя утверждать по сайту",
    result.cannotConclude.map((item) => `- ${item}`).join("\n"),
    "## Следующий вопрос",
    POST_WEBSITE_SCREENING_REQUEST_TEXT,
  ].join("\n\n");
}

async function persistWebsiteScreening(params: {
  telegramUserId: number;
  telegramUsername?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  rawText: string;
  result: WebsiteScreeningResult;
  replyText: string;
}) {
  const user = await getOrCreateTelegramAppUser({
    telegramUserId: params.telegramUserId,
    telegramUsername: params.telegramUsername,
    firstName: params.firstName,
    lastName: params.lastName,
  });
  const { company, workspace } = await getActiveCompanyContextForCase(user.id);
  const businessCase = await createCase({
    userId: user.id,
    companyId: company?.id ?? null,
    workspaceId: workspace.id,
    source: "telegram",
    initialMessage: params.rawText,
    currentStage: "preliminary_screening",
  });

  await appendCaseMessage({
    caseId: businessCase.id,
    role: "user",
    text: params.rawText,
    metadata: {
      telegramUserId: params.telegramUserId,
      entryMode: "problem_first",
      screeningType: "website_only",
    },
  });

  const completion = await completePreliminaryScreening({
    caseId: businessCase.id,
    title: "Предварительный скрининг сайта",
    summary: params.result.observedPositioning,
    contentMarkdown: buildWebsiteScreeningMarkdown(params.result),
  });

  await appendCaseMessage({
    caseId: completion.case.id,
    role: "assistant",
    text: params.replyText,
    metadata: {
      artifactId: completion.artifactId,
      artifactType: "preliminary_screening",
    },
  });

  return buildCaseDeepLink({
    caseId: completion.case.id,
    token: completion.case.publicShareToken,
  });
}

async function buildReplyAndPersist(params: {
  telegramUserId: number;
  telegramUsername?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  rawText: string;
  result: WebsiteScreeningResult;
  fallbackDiagnosisUrl: string;
}) {
  const previewReply = formatWebsiteScreeningReply({
    result: params.result,
    caseUrl: params.fallbackDiagnosisUrl,
  });
  const caseUrl = await persistWebsiteScreening({
    telegramUserId: params.telegramUserId,
    telegramUsername: params.telegramUsername,
    firstName: params.firstName,
    lastName: params.lastName,
    rawText: params.rawText,
    result: params.result,
    replyText: previewReply.text,
  });

  return formatWebsiteScreeningReply({
    result: params.result,
    caseUrl,
  });
}

export async function runTelegramWebsiteScreening(params: {
  telegramUserId: number;
  telegramUsername?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  rawText: string;
  entryMode: string;
  entryIntent: string;
}): Promise<TelegramEntryReply> {
  const websiteContext = await extractWebsiteContextFromText(params.rawText);
  const apiKey = process.env.OPENAI_API_KEY;
  const model = getOpenAiModel();
  const temperature = getOpenAiNumberEnv("OPENAI_TEMPERATURE", 0.2);
  const maxOutputTokens = getOpenAiNumberEnv("OPENAI_MAX_TOKENS", 1200);
  const diagnosisUrl = buildDiagnosisDeepLink({
    entryMode: params.entryMode,
    entryIntent: params.entryIntent,
  });

  if (!apiKey) {
    return buildReplyAndPersist({
      telegramUserId: params.telegramUserId,
      telegramUsername: params.telegramUsername,
      firstName: params.firstName,
      lastName: params.lastName,
      rawText: params.rawText,
      result: buildFallbackWebsiteScreening(websiteContext),
      fallbackDiagnosisUrl: diagnosisUrl,
    });
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
            content: WEBSITE_SCREENING_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                rawText: params.rawText,
                websiteContext,
              },
              null,
              2,
            ),
          },
        ],
        metadata: {
          feature: "website_screening",
        },
        text: {
          format: {
            type: "json_schema",
            name: "website_screening_result",
            strict: true,
            schema: WEBSITE_SCREENING_JSON_SCHEMA,
          },
        },
      }),
    });

    if (!response.ok) {
      console.error("WEBSITE_SCREENING_LLM_HTTP_ERROR", {
        status: response.status,
      });
      return buildReplyAndPersist({
        telegramUserId: params.telegramUserId,
        telegramUsername: params.telegramUsername,
        firstName: params.firstName,
        lastName: params.lastName,
        rawText: params.rawText,
        result: buildFallbackWebsiteScreening(websiteContext),
        fallbackDiagnosisUrl: diagnosisUrl,
      });
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const output = getStructuredOutput(payload);

    if (!output) {
      console.error("WEBSITE_SCREENING_EMPTY_OUTPUT");
      return buildReplyAndPersist({
        telegramUserId: params.telegramUserId,
        telegramUsername: params.telegramUsername,
        firstName: params.firstName,
        lastName: params.lastName,
        rawText: params.rawText,
        result: buildFallbackWebsiteScreening(websiteContext),
        fallbackDiagnosisUrl: diagnosisUrl,
      });
    }

    const parsed = websiteScreeningResultSchema.parse(JSON.parse(output));

    if (shouldUseRussianFallback(parsed)) {
      console.warn("WEBSITE_SCREENING_NON_RUSSIAN_OUTPUT");
      return buildReplyAndPersist({
        telegramUserId: params.telegramUserId,
        telegramUsername: params.telegramUsername,
        firstName: params.firstName,
        lastName: params.lastName,
        rawText: params.rawText,
        result: buildFallbackWebsiteScreening(websiteContext),
        fallbackDiagnosisUrl: diagnosisUrl,
      });
    }

    return buildReplyAndPersist({
      telegramUserId: params.telegramUserId,
      telegramUsername: params.telegramUsername,
      firstName: params.firstName,
      lastName: params.lastName,
      rawText: params.rawText,
      result: parsed,
      fallbackDiagnosisUrl: diagnosisUrl,
    });
  } catch (error) {
    console.error("WEBSITE_SCREENING_FAILED", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return buildReplyAndPersist({
      telegramUserId: params.telegramUserId,
      telegramUsername: params.telegramUsername,
      firstName: params.firstName,
      lastName: params.lastName,
      rawText: params.rawText,
      result: buildFallbackWebsiteScreening(websiteContext),
      fallbackDiagnosisUrl: diagnosisUrl,
    });
  }
}
