import "server-only";

import { getOpenAiModel, getOpenAiNumberEnv } from "@/lib/openai/model-config";

import { DIAGNOSTIC_CORE_SYSTEM_PROMPT } from "./prompt";
import {
  DIAGNOSTIC_CORE_JSON_SCHEMA,
  diagnosticInputSchema,
  diagnosticStructuredResultSchema,
  type DiagnosticInput,
  type DiagnosticStructuredResult,
} from "./schema";

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

function postProcessDiagnosticResult(result: DiagnosticStructuredResult) {
  return diagnosticStructuredResultSchema.parse({
    ...result,
    symptoms: result.symptoms.slice(0, 7),
    dominantSituations: result.dominantSituations.slice(0, 3),
    doNotDoNow: result.doNotDoNow.slice(0, 5),
    toolRecommendations: result.toolRecommendations.slice(0, 4),
    firstWave: {
      ...result.firstWave,
      directions: result.firstWave.directions.slice(0, 2),
      expectedChanges: result.firstWave.expectedChanges.slice(0, 4),
      successSignals: result.firstWave.successSignals.slice(0, 4),
    },
    secondWave: {
      ...result.secondWave,
      transitionSignals: result.secondWave.transitionSignals.slice(0, 4),
      whatToConsolidate: result.secondWave.whatToConsolidate.slice(0, 4),
      nextBottleneckToPrevent: result.secondWave.nextBottleneckToPrevent.slice(0, 4),
    },
  });
}

export async function runDiagnosticCore(
  input: DiagnosticInput,
): Promise<DiagnosticStructuredResult> {
  const parsedInput = diagnosticInputSchema.parse(input);
  const apiKey = process.env.OPENAI_API_KEY;
  const model = getOpenAiModel();
  const temperature = getOpenAiNumberEnv("OPENAI_TEMPERATURE", 0.2);
  const maxOutputTokens = getOpenAiNumberEnv("OPENAI_MAX_TOKENS", 2600);

  if (!apiKey) {
    throw new Error("Diagnostic core is unavailable because OPENAI_API_KEY is missing.");
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
            content: DIAGNOSTIC_CORE_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: JSON.stringify(parsedInput, null, 2),
          },
        ],
        metadata: {
          feature: "diagnostic_core",
        },
        text: {
          format: {
            type: "json_schema",
            name: "diagnostic_structured_result",
            strict: true,
            schema: DIAGNOSTIC_CORE_JSON_SCHEMA,
          },
        },
      }),
    });

    if (!response.ok) {
      console.error("DIAGNOSTIC_CORE_LLM_HTTP_ERROR", {
        status: response.status,
      });
      throw new Error(`Diagnostic core HTTP error: ${response.status}`);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const text = getStructuredOutput(payload);

    if (!text) {
      console.error("DIAGNOSTIC_CORE_EMPTY_OUTPUT");
      throw new Error("Diagnostic core returned empty output.");
    }

    const raw = JSON.parse(text) as unknown;
    return postProcessDiagnosticResult(diagnosticStructuredResultSchema.parse(raw));
  } catch (error) {
    console.error("DIAGNOSTIC_CORE_FAILED", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    throw error instanceof Error ? error : new Error("Diagnostic core failed.");
  }
}
