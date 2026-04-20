import "server-only";

import { QUICK_SCAN_SYSTEM_PROMPT } from "./prompt";
import {
  QUICK_SCAN_JSON_SCHEMA,
  quickScanInputSchema,
  quickScanResultSchema,
  type QuickScanInput,
  type QuickScanResult,
} from "./schema";
import { buildQuickScanFallback } from "./fallback";

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

function postProcessQuickScan(result: QuickScanResult): QuickScanResult {
  return quickScanResultSchema.parse({
    ...result,
    likelyLossZones: result.likelyLossZones.slice(0, 4),
    constraintVersions: result.constraintVersions.slice(0, 3),
    toolCandidates: result.toolCandidates.slice(0, 4),
    disclaimer:
      result.disclaimer.trim().length > 0
        ? result.disclaimer
        : "Это предварительный скрининг по минимальному контексту, а не финальный диагноз.",
  });
}

export async function runQuickScan(input: QuickScanInput): Promise<QuickScanResult> {
  const parsedInput = quickScanInputSchema.parse(input);
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const temperature = Number(process.env.OPENAI_TEMPERATURE ?? "0.2");
  const maxOutputTokens = Number(process.env.OPENAI_MAX_TOKENS ?? "1100");

  if (!apiKey) {
    return buildQuickScanFallback(parsedInput);
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
        temperature: Number.isFinite(temperature) ? temperature : 0.2,
        max_output_tokens: Number.isFinite(maxOutputTokens) ? maxOutputTokens : 1100,
        input: [
          {
            role: "system",
            content: QUICK_SCAN_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: JSON.stringify(parsedInput, null, 2),
          },
        ],
        metadata: {
          feature: "quick_scan",
        },
        text: {
          format: {
            type: "json_schema",
            name: "quick_scan_result",
            strict: true,
            schema: QUICK_SCAN_JSON_SCHEMA,
          },
        },
      }),
    });

    if (!response.ok) {
      console.error("QUICK_SCAN_LLM_HTTP_ERROR", {
        status: response.status,
      });
      return buildQuickScanFallback(parsedInput);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const text = getStructuredOutput(payload);

    if (!text) {
      console.error("QUICK_SCAN_EMPTY_OUTPUT");
      return buildQuickScanFallback(parsedInput);
    }

    const raw = JSON.parse(text) as unknown;
    return postProcessQuickScan(quickScanResultSchema.parse(raw));
  } catch (error) {
    console.error("QUICK_SCAN_FALLBACK", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return buildQuickScanFallback(parsedInput);
  }
}
