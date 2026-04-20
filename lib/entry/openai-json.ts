import "server-only";

import { getOpenAiModel, getOpenAiNumberEnv } from "@/lib/openai/model-config";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

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

export async function callOpenAiJson<T>(params: {
  feature: string;
  systemPrompt: string;
  userPayload: unknown;
  schemaName: string;
  schema: object;
  maxOutputTokens?: number;
  temperature?: number;
  onErrorLabel: string;
}): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = getOpenAiModel();
  const temperature = params.temperature ?? getOpenAiNumberEnv("OPENAI_TEMPERATURE", 0.2);
  const maxOutputTokens =
    params.maxOutputTokens ?? getOpenAiNumberEnv("OPENAI_MAX_TOKENS", 2200);

  if (!apiKey) {
    throw new Error(`${params.onErrorLabel} is unavailable because OPENAI_API_KEY is missing.`);
  }

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
          content: params.systemPrompt,
        },
        {
          role: "user",
          content: JSON.stringify(params.userPayload, null, 2),
        },
      ],
      metadata: {
        feature: params.feature,
      },
      text: {
        format: {
          type: "json_schema",
          name: params.schemaName,
          strict: true,
          schema: params.schema,
        },
      },
    }),
  });

  if (!response.ok) {
    console.error(`${params.onErrorLabel.toUpperCase()}_HTTP_ERROR`, {
      status: response.status,
    });
    throw new Error(`${params.onErrorLabel} HTTP error: ${response.status}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const text = getStructuredOutput(payload);

  if (!text) {
    console.error(`${params.onErrorLabel.toUpperCase()}_EMPTY_OUTPUT`);
    throw new Error(`${params.onErrorLabel} returned empty output.`);
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    console.error(`${params.onErrorLabel.toUpperCase()}_INVALID_JSON`, {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    throw new Error(`${params.onErrorLabel} returned invalid JSON.`);
  }
}
