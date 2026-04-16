import type { Json } from "@/types/db";
import type { DiagnosisQuestionOption } from "@/types/domain";

export function parseQuestionOptions(value: Json): DiagnosisQuestionOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const candidate = item as Record<string, unknown>;
    const optionValue = candidate.value;
    const optionLabel = candidate.label;

    if (typeof optionValue !== "number" || typeof optionLabel !== "string") {
      return [];
    }

    return [
      {
        value: optionValue,
        label: optionLabel,
      },
    ];
  });
}
