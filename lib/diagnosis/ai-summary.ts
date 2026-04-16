import "server-only";

import { diagnosisAiSummarySchema } from "@/validators/diagnosis";

import type {
  DiagnosisAiSummary,
  DiagnosisDimensionScore,
  DiagnosisSummaryContext,
} from "@/types/domain";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const SYSTEM_PROMPT = `Ты — управленческий консультант уровня McKinsey/BCG.

Твоя задача — на основе диагностики бизнеса дать короткий, жёсткий и полезный управленческий вывод.

Ты не пишешь красивый текст.
Ты сокращаешь сложность бизнеса до одного главного ограничения и нескольких приоритетных действий.

========================
ШАГ 1 — INTERNAL ANALYSIS (НЕ ПОКАЗЫВАТЬ)
======================================================

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
3. причинно-следственную цепочку:
   причина → механизм → эффект
4. что является:

   * корневой причиной
   * симптомом
   * следствием

Затем составь список возможных причин, которые реально ограничивают:

* рост
* прибыль
* масштабируемость

После этого ОБЯЗАТЕЛЬНО:

1. убери дубли
2. объедини близкие по смыслу причины в одну более сильную формулировку
3. оцени каждую причину по силе влияния на:

   * рост
   * прибыль
   * масштабируемость
4. выбери только 3 самые сильные причины

Правила дедупликации:

* не выводи две причины, если они относятся к одному и тому же ядру проблемы
* если "нет стратегии", "нет понятного направления", "размыт фокус" — это одна причина
* если "слабое управление", "нет ритма", "нет контроля", "решения не оформлены" — это одна причина
* если "процессы нестабильны", "много ручного управления", "операции не стандартизированы" — это одна причина
* выбирай более сильную и более общую формулировку

Важно:

* здесь думай глубоко
* этот анализ не должен попадать в ответ пользователю

---

========================
ШАГ 2 — FINAL OUTPUT (ТОЛЬКО ЭТО ВИДИТ ПОЛЬЗОВАТЕЛЬ)
====================================================

Теперь сократи весь анализ до сути.

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
* 1 главный диагноз
* читается за 5 секунд

MAIN_FOCUS:

* только 1 идея
* нельзя использовать "и"
* если есть несколько смыслов — выбери один главный

WHY_NOW:

* строго 3 пункта
* не больше
* каждый пункт = причина → эффект
* только top-3 причины после приоритизации
* не дублируй причины между собой
* не используй разные формулировки для одной и той же проблемы

STRENGTHS:

* ровно 2 пункта
* только реальные опоры
* каждая опора должна намекать, почему изменения вообще возможны

FIRST_STEPS:

* 3 шага
* первый шаг = конкретное действие (можно сделать сегодня)
* шаги должны идти в логическом порядке
* не пиши абстрактно

---

========================
КРИТИЧЕСКОЕ ПРАВИЛО
===================

Ты не объясняешь бизнес.

Ты сокращаешь сложность до одного решения.

Если видишь 7 проблем:

* не перечисляй их
* сгруппируй
* оставь только ядро

Если причины похожи:

* объединяй их
* не дублируй

Если сомневаешься:
→ убери лишнее
→ оставь более сильную формулировку

Пиши как для собственника, у которого 5 минут:

* коротко
* жёстко
* по делу`;

function buildUserMessage(
  summaryContext: DiagnosisSummaryContext,
  dimensionScores: DiagnosisDimensionScore[],
) {
  const scoreByDimension = new Map(
    dimensionScores.map((item) => [item.dimension, item.averageScore]),
  );

  return JSON.stringify(
    {
      company: {
        name: summaryContext.company?.name ?? null,
        industry: summaryContext.company?.industry ?? null,
        teamSize: summaryContext.company?.teamSize ?? null,
        revenue: summaryContext.company?.revenueRange ?? null,
        goal: summaryContext.company?.primaryGoal ?? null,
      },
      scores: {
        owner: scoreByDimension.get("owner") ?? null,
        market: scoreByDimension.get("external_environment") ?? null,
        strategy: scoreByDimension.get("strategy") ?? null,
        product: scoreByDimension.get("product") ?? null,
        sales: scoreByDimension.get("commercial") ?? null,
        operations: scoreByDimension.get("operations") ?? null,
        finance: scoreByDimension.get("finance") ?? null,
        team: scoreByDimension.get("team") ?? null,
        management: scoreByDimension.get("governance") ?? null,
        tech: scoreByDimension.get("technology") ?? null,
        data: scoreByDimension.get("data") ?? null,
      },
    },
    null,
    2,
  );
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

function trimStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function buildFallbackWhyNow(summaryContext: DiagnosisSummaryContext) {
  const problems = summaryContext.topProblems.slice(0, 3);

  if (problems.length === 3) {
    return problems;
  }

  return [
    "Ключевое ограничение замедляет рост → компания теряет скорость решений и исполнения.",
    "Узкое место держит управление в ручном режиме → масштабировать результат становится сложнее.",
    "Пока проблема не выровнена → прибыль и устойчивость остаются менее предсказуемыми.",
  ];
}

function buildFallbackStrengths(summaryContext: DiagnosisSummaryContext) {
  const strengths = summaryContext.strongestDomains.slice(0, 2);

  if (strengths.length === 2) {
    return strengths.map(
      (item) =>
        `Зона «${item}» уже даёт опору → на неё можно опереться при ближайших изменениях.`,
    );
  }

  return [
    "В бизнесе уже есть рабочие элементы системы → изменения можно не придумывать с нуля.",
    "Даже частичная управляемость даёт опору → значит быстрые улучшения уже реалистичны.",
  ];
}

function buildFallbackFirstSteps(summaryContext: DiagnosisSummaryContext) {
  const firstTool = summaryContext.recommendedTools[0];

  return [
    firstTool
      ? `Сегодня зафиксируйте одно узкое место и откройте инструмент «${firstTool.title}».`
      : "Сегодня зафиксируйте одно главное ограничение, которое сильнее всего тормозит рост.",
    "Назначьте одного владельца за разбор этой проблемы и зафиксируйте срок первого результата.",
    "Через короткий цикл проверьте эффект и решите, что масштабировать дальше.",
  ];
}

function postProcessAiSummary(
  raw: {
    mainSummary?: unknown;
    mainFocus?: unknown;
    whyNow?: unknown;
    strengths?: unknown;
    firstSteps?: unknown;
  },
  summaryContext: DiagnosisSummaryContext,
) {
  const whyNow = trimStringArray(raw.whyNow);
  const strengths = trimStringArray(raw.strengths);
  const firstSteps = trimStringArray(raw.firstSteps);
  const mainSummary =
    typeof raw.mainSummary === "string" ? raw.mainSummary.trim() : "";
  const mainFocus =
    typeof raw.mainFocus === "string" ? raw.mainFocus.trim() : "";

  const normalizedWhyNow =
    whyNow.length >= 3 ? whyNow.slice(0, 3) : buildFallbackWhyNow(summaryContext);
  const normalizedStrengths =
    strengths.length >= 2 ? strengths.slice(0, 2) : buildFallbackStrengths(summaryContext);
  const normalizedFirstSteps =
    firstSteps.length >= 3 ? firstSteps.slice(0, 3) : buildFallbackFirstSteps(summaryContext);

  if (mainFocus.length > 120 || /\sи\s/i.test(mainFocus)) {
    console.error("AI SUMMARY MAIN FOCUS REVIEW:", {
      mainFocus,
      reason: "Focus looks too long or contains multiple meanings.",
    });
  }

  return {
    mainSummary,
    mainFocus,
    whyNow: normalizedWhyNow,
    strengths: normalizedStrengths,
    firstSteps: normalizedFirstSteps,
  };
}

export async function generateDiagnosisAiSummary(
  summaryContext: DiagnosisSummaryContext,
  dimensionScores: DiagnosisDimensionScore[],
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
    const userMessage = buildUserMessage(summaryContext, dimensionScores);

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
            content: userMessage,
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
    const parsed = diagnosisAiSummarySchema.safeParse(
      postProcessAiSummary(
        {
          mainSummary: json.main_summary,
          mainFocus: json.main_focus,
          whyNow: json.why_now,
          strengths: json.strengths,
          firstSteps: json.first_steps,
        },
        summaryContext,
      ),
    );

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
