import "server-only";

import { diagnosisChatReplySchema } from "@/validators/diagnosis";

import type { DiagnosisChatContext, DiagnosisChatReply } from "@/types/domain";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

const DIAGNOSIS_CHAT_SYSTEM_PROMPT = `Ты — интерпретатор результата диагностики бизнеса.

Ты не общий бизнес-ассистент.
Ты работаешь только с тем результатом диагностики, который тебе передан.

Твоя задача:
* объяснить главный вывод по результату
* помочь выделить приоритет
* перевести выводы в конкретные действия

Правила:
* не придумывай данные
* не уходи в общую теорию
* не консультируй "вообще про бизнес"
* опирайся только на context и question
* если вопрос слишком общий или вне рамки диагностики, мягко верни пользователя к его результату
* пиши коротко, ясно и по делу
* отвечай как для собственника, у которого мало времени

Формат ответа строго JSON:
{
  "reply": "..."
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

export async function generateDiagnosisChatReply(params: {
  context: DiagnosisChatContext;
  question: string;
}): Promise<DiagnosisChatReply | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const temperature = Number(process.env.OPENAI_TEMPERATURE ?? "0.3");
  const maxOutputTokens = Number(process.env.OPENAI_MAX_TOKENS ?? "800");
  const promptVersion = process.env.OPENAI_SYSTEM_PROMPT_VERSION ?? "v1";

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
            content: DIAGNOSIS_CHAT_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                context: params.context,
                question: params.question,
              },
              null,
              2,
            ),
          },
        ],
        metadata: {
          prompt_version: promptVersion,
          feature: "diagnosis_ai_chat",
        },
        text: {
          format: {
            type: "json_schema",
            name: "diagnosis_ai_chat",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                answer: {
                  type: "string",
                },
                reply: {
                  type: "string",
                },
              },
              required: ["reply"],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      console.error("DIAGNOSIS CHAT ERROR:", await response.text());
      return null;
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const text = getStructuredOutput(payload);

    if (!text) {
      return null;
    }

    const json = JSON.parse(text) as { answer?: unknown; reply?: unknown };
    const parsed = diagnosisChatReplySchema.safeParse({
      reply:
        typeof json.reply === "string"
          ? json.reply
          : typeof json.answer === "string"
            ? json.answer
            : "",
    });

    if (!parsed.success) {
      console.error("DIAGNOSIS CHAT PARSE ERROR:", parsed.error.flatten());
      return null;
    }

    return parsed.data;
  } catch (error) {
    console.error("DIAGNOSIS CHAT ERROR:", error);
    return null;
  }
}
