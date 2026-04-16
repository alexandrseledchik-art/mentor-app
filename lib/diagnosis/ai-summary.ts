import "server-only";

import { diagnosisAiSummarySchema } from "@/validators/diagnosis";

import type { DiagnosisAiSummary, DiagnosisSummaryContext } from "@/types/domain";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DIAGNOSIS_AI_SUMMARY_SYSTEM_PROMPT = `Ты — сильный бизнес-ментор и стратег, который помогает собственнику увидеть реальную картину бизнеса и понять, куда смотреть в первую очередь.

Тебе передаётся уже рассчитанный и структурированный результат диагностики бизнеса.
Ты не считаешь результат заново и не придумываешь новые данные.
Ты только интерпретируешь то, что уже известно.

Твоя задача:
сформировать короткий, ясный и сильный вывод для собственника.

Входные данные:
summaryContext:
- weakestDomains: список самых слабых зон бизнеса
- strongestDomains: список сильных зон
- topProblems: список ключевых проблем в человекочитаемом виде
- recommendedTools: массив рекомендованных инструментов:
  - title
  - whyRecommended
- company:
  - name
  - industry
  - teamSize
  - revenueRange
  - primaryGoal

Что нужно вернуть:
строго JSON формата:

{
  "shortSummary": "...",
  "keyFocus": "...",
  "whyNow": "..."
}

Требования к полям:

shortSummary:
- 2–3 предложения
- коротко описывает общее состояние бизнеса
- обязательно опирается на weakestDomains
- может кратко упомянуть strongestDomains, если это усиливает смысл
- без воды и без абстракций

keyFocus:
- один главный приоритет
- одна конкретная зона фокуса
- без списка
- без длинных формулировок

whyNow:
- объясняет, почему именно этот фокус важен сейчас
- связывает слабые зоны с последствиями
- можно опираться на topProblems и recommendedTools

Стиль:
- пиши как сильный бизнес-ментор
- просто
- коротко
- по делу
- без канцелярита
- без мотивационной воды
- без сложных терминов
- без слов "возможно", "вероятно", "скорее всего"

Ограничения:
- не выдумывай данные
- не добавляй новые инструменты
- не противоречь weakestDomains
- не используй markdown
- не добавляй ничего кроме JSON
- если слабых зон 1–2, делай акцент именно на них
- если сильные зоны есть, используй их только как усиление вывода, а не как главный акцент

Пример хорошего ответа:

{
  "shortSummary": "Сейчас бизнес частично опирается на систему, но ключевые ограничения находятся в финансах и продукте. Из-за этого рост становится менее управляемым, а часть решений по-прежнему завязана на ручное управление. При этом коммерция уже начинает работать как более устойчивый контур.",
  "keyFocus": "Собрать базовую систему прозрачности денег и управляемости продукта.",
  "whyNow": "Пока нет ясности в деньгах и в продуктовой опоре, рост будет нестабильным, а усилия команды — распыляться. Это ограничивает масштабирование и усиливает зависимость бизнеса от ручных решений."
}`;

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
            content: DIAGNOSIS_AI_SUMMARY_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                summaryContext,
              },
              null,
              2,
            ),
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
                shortSummary: {
                  type: "string",
                  description: "2-3 коротких предложения о состоянии бизнеса.",
                },
                keyFocus: {
                  type: "string",
                  description: "Один главный фокус на ближайший шаг.",
                },
                whyNow: {
                  type: "string",
                  description: "Короткое объяснение, почему этот фокус важнее остального сейчас.",
                },
              },
              required: ["shortSummary", "keyFocus", "whyNow"],
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

    const json = JSON.parse(text) as unknown;
    const parsed = diagnosisAiSummarySchema.safeParse(json);

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
