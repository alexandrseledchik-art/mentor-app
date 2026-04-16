import "server-only";

import { diagnosisAiSummarySchema } from "@/validators/diagnosis";

import type { DiagnosisAiSummary, DiagnosisSummaryContext } from "@/types/domain";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const SYSTEM_PROMPT = `Ты — управленческий консультант уровня McKinsey/BCG.

Твоя задача — на основе диагностики бизнеса дать короткий, жёсткий и полезный управленческий вывод.

---

========================
ШАГ 1 — INTERNAL ANALYSIS (НЕ ПОКАЗЫВАТЬ)
=========================================

Проанализируй бизнес как систему по слоям:

* внешняя среда
* собственник
* стратегия
* продукт
* коммерция (продажи)
* операции
* финансы
* команда
* технологии и данные
* управление
* трансформация

Определи:

1. главное ограничение бизнеса (одно)
2. вторичные проблемы
3. причинно-следственную цепочку (что вызывает что)
4. что является причиной, а что симптомом

Важно:

* здесь думай глубоко
* учитывай все взаимосвязи
* НЕ выводи этот анализ пользователю

---

========================
ШАГ 2 — FINAL OUTPUT (ТОЛЬКО ЭТО ВИДИТ ПОЛЬЗОВАТЕЛЬ)
====================================================

Теперь сократи весь анализ до сути.

Ты НЕ имеешь права показывать всё.

Ты обязан выбрать главное.

---

Формат ответа:

{
"main_summary": "...",
"main_focus": "...",
"why_now": ["...", "...", "..."],
"strengths": ["...", "..."],
"first_steps": ["...", "...", "..."]
}

---

========================
ТРЕБОВАНИЯ
==========

MAIN_SUMMARY:

* максимум 2 предложения
* один диагноз
* читается за 5 секунд

MAIN_FOCUS:

* только 1 идея
* нельзя использовать "и"
* если есть несколько — выбери одну

WHY_NOW:

* строго 3 пункта
* не больше
* каждый пункт = причина → эффект
* убери всё вторичное

STRENGTHS:

* 2 опоры
* с намёком на действие

FIRST_STEPS:

* 3 шага
* первый шаг = конкретное действие (можно сделать сегодня)

---

========================
КРИТИЧЕСКОЕ ПРАВИЛО
===================

Ты не объясняешь бизнес.

Ты сокращаешь сложность до одного решения.

Если сомневаешься:
→ убери лишнее
→ оставь главное

Пиши как для собственника, у которого 5 минут:

* коротко
* жёстко
* по делу`;

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
            content: systemPrompt,
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
