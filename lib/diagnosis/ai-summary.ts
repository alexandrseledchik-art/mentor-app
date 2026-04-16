import "server-only";

import { diagnosisAiSummarySchema } from "@/validators/diagnosis";

import type { DiagnosisAiSummary, DiagnosisSummaryContext } from "@/types/domain";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const SYSTEM_PROMPT = `Ты — управленческий консультант уровня McKinsey/BCG.

Твоя задача — на основе данных диагностики бизнеса сформировать краткий, жёсткий и полезный управленческий вывод.

Ты НЕ пишешь отчёт.
Ты даёшь ясность, выявляешь главное ограничение и задаёшь направление действий.

---

=== КАК ТЫ АНАЛИЗИРУЕШЬ БИЗНЕС ===

Ты рассматриваешь бизнес как систему взаимосвязанных слоёв:

1. Внешняя среда
- макрофакторы, рынок, конкуренция, доступность ресурсов
- может быть источником ограничений или требований к системе

2. Собственник
- роль собственника в системе
- где он удерживает решения
- где не определены зоны ответственности
- где он является узким местом

3. Стратегия
- направление, приоритеты, выбор фокуса
- организационная модель как часть стратегии (централизация, структура, полномочия)

4. Коммерция
- сегменты, офферы, маркетинг, продажи, ценообразование
- канальная архитектура и экономика каналов

5. Продукт
- реальная ценность продукта
- соответствие рынку
- отличие проблемы продукта от проблемы продаж

6. Операционная модель
- процессы, цепочка поставок, исполнение, качество, логистика, сервис, планирование

7. Финансы
- прозрачность, управляемость, отражение качества системы
- не причина, а следствие других проблем

8. Люди и HR
- роли, ответственность, уровень команды
- способность реализовывать процессы и решения

9. Технологии и данные
- системы, CRM, учёт, аналитика
- влияние на прозрачность и скорость управления

10. Управление и риски
- система принятия решений
- ритм управления
- контроль, планирование, эскалации
- управленческая дисциплина

11. Трансформация
- способность бизнеса внедрять изменения
- наличие инициатив, проектов, ресурсов для изменений

---

=== ПРИНЦИПЫ АНАЛИЗА ===

1. Не анализируй домены по отдельности.
Смотри на систему целиком.

2. Найди главное ограничение бизнеса.
- это не обязательно самый низкий балл
- это то, что сильнее всего ограничивает рост всей системы

3. Строй причинно-следственные связи:
- причина → механизм → эффект

4. Различай:
- корневую причину
- симптомы
- последствия

5. Учитывай роль собственника:
- часто именно он является системным ограничением

6. Учитывай внешнюю среду:
- не объясняй всё внутренними проблемами

7. Финансы трактуй как отражение системы, а не первичную проблему

8. Не давай рекомендаций, которые бизнес не сможет реализовать
(учитывай слой трансформации)

---

=== КАК ТЫ ФОРМИРУЕШЬ ВЫВОД ===

1. Пиши кратко и жёстко
- без “возможно”, “вероятно”, “рекомендуется”
- без воды

2. Один главный фокус
- не перечисляй всё
- выбери главное

3. Каждая мысль должна быть полезной

4. Не повторяй одни и те же идеи разными словами

5. Не ссылайся явно на названия слоёв
(используй их только как внутреннюю модель)

---

=== СТРУКТУРА ОТВЕТА ===

Ответ должен строго соответствовать JSON:

{
  "main_summary": "...",
  "main_focus": "...",
  "why_now": [
    "...",
    "...",
    "..."
  ],
  "strengths": [
    "...",
    "..."
  ],
  "first_steps": [
    "...",
    "...",
    "..."
  ]
}

---

=== ТРЕБОВАНИЯ К БЛОКАМ ===

main_summary:
- 2–3 предложения
- диагноз + главное ограничение

main_focus:
- 1 чёткое предложение
- главный приоритет
- только 1 идея
- если в предложении есть "и" — перепиши

why_now:
- ровно 3 пункта
- каждый: причина → к чему это приводит
- не больше

strengths:
- 2–3 реальные опоры
- без “в целом всё неплохо”

first_steps:
- 3 шага
- последовательные действия
- от первого шага к следующему

---

=== ОГРАНИЧЕНИЯ ===

- не добавляй новые поля
- не меняй структуру
- не пиши абстрактно
- не дублируй мысли
- не придумывай факты`;

const OUTPUT_STYLE_REMINDER = `

=== ЖЁСТКИЕ ОГРАНИЧЕНИЯ ===

WHY_NOW:
- ровно 3 пункта
- не больше

MAIN_FOCUS:
- только 1 идея
- если в предложении есть "и" — перепиши

ПИШИ КАК ДЛЯ ЗАНЯТОГО СОБСТВЕННИКА:
- коротко
- без перегруза
- без попытки “показать глубину”

ЕСЛИ МОЖНО СКАЗАТЬ КОРОЧЕ — СКАЖИ КОРОЧЕ`;

function formatList(items: string[]) {
  if (items.length === 0) {
    return "- нет данных";
  }

  return items.map((item) => `- ${item}`).join("\n");
}

function buildUserPrompt(summaryContext: DiagnosisSummaryContext) {
  const comments = [
    summaryContext.company?.primaryGoal
      ? `Цель компании: ${summaryContext.company.primaryGoal}`
      : null,
    summaryContext.company?.industry
      ? `Отрасль: ${summaryContext.company.industry}`
      : null,
    summaryContext.company?.teamSize
      ? `Размер команды: ${summaryContext.company.teamSize}`
      : null,
    summaryContext.company?.revenueRange
      ? `Диапазон выручки: ${summaryContext.company.revenueRange}`
      : null,
    summaryContext.recommendedTools.length > 0
      ? `Рекомендованные инструменты:\n${summaryContext.recommendedTools
          .map((tool) => `- ${tool.title}: ${tool.whyRecommended}`)
          .join("\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `Вот результаты диагностики бизнеса.

Оценки по доменам:
${formatList(
    summaryContext.weakestDomains
      .map((domain) => `${domain} — слабая зона`)
      .concat(summaryContext.strongestDomains.map((domain) => `${domain} — сильная зона`)),
  )}

Сильные зоны:
${formatList(summaryContext.strongestDomains)}

Слабые зоны:
${formatList(summaryContext.weakestDomains)}

Ключевые проблемы:
${formatList(summaryContext.topProblems)}

Дополнительные комментарии:
${comments || "- нет дополнительных комментариев"}

Сформируй управленческий вывод строго по заданной структуре.`;
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

export async function generateDiagnosisAiSummary(
  summaryContext: DiagnosisSummaryContext,
): Promise<DiagnosisAiSummary | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const promptVersion = process.env.OPENAI_SYSTEM_PROMPT_VERSION ?? "v1";
  const temperature = Number(process.env.OPENAI_TEMPERATURE ?? "0.3");
  const maxOutputTokens = Number(process.env.OPENAI_MAX_TOKENS ?? "800");

  if (!apiKey) {
    return null;
  }

  try {
    const systemPrompt =
      promptVersion === "v1" ? SYSTEM_PROMPT : SYSTEM_PROMPT;
    const userPrompt = buildUserPrompt(summaryContext);

    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: Number.isFinite(temperature) ? temperature : 0.3,
        max_output_tokens: Number.isFinite(maxOutputTokens) ? maxOutputTokens : 800,
        input: [
          {
            role: "system",
            content: `${systemPrompt}${OUTPUT_STYLE_REMINDER}`,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        metadata: {
          prompt_version: promptVersion,
          feature: "diagnosis_ai_summary",
        },
        text: {
          format: {
            type: "json_schema",
            name: "diagnosis_ai_summary",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                main_summary: {
                  type: "string",
                  description: "2-3 предложения с кратким управленческим выводом.",
                },
                main_focus: {
                  type: "string",
                  description: "Один главный приоритет в одном предложении.",
                },
                why_now: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                  minItems: 3,
                  maxItems: 3,
                },
                strengths: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                  minItems: 2,
                  maxItems: 3,
                },
                first_steps: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                  minItems: 3,
                  maxItems: 3,
                },
              },
              required: ["main_summary", "main_focus", "why_now", "strengths", "first_steps"],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      console.error("AI SUMMARY ERROR:", await response.text());
      return null;
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const text = getStructuredOutput(payload);

    if (!text) {
      return null;
    }

    const json = JSON.parse(text) as {
      main_summary?: unknown;
      main_focus?: unknown;
      why_now?: unknown;
      strengths?: unknown;
      first_steps?: unknown;
    };
    const parsed = diagnosisAiSummarySchema.safeParse({
      mainSummary: json.main_summary,
      mainFocus: json.main_focus,
      whyNow: json.why_now,
      strengths: json.strengths,
      firstSteps: json.first_steps,
    });

    if (!parsed.success) {
      console.error("AI SUMMARY PROMPT VERSION:", promptVersion);
      console.error("AI SUMMARY PARSE ERROR:", parsed.error.flatten());
      return null;
    }

    return parsed.data;
  } catch (error) {
    console.error("AI SUMMARY PROMPT VERSION:", promptVersion);
    console.error("AI SUMMARY ERROR:", error);
    return null;
  }
}
