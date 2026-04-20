import type {
  EntryConversationFrame,
  EntryIntent,
  EntryMode,
  EntrySessionState,
} from "@/types/domain";

type TelegramDiagnosticThresholdParams = {
  mode: EntryMode;
  intent: EntryIntent | null;
  rawText: string;
  turnCount: number;
  session: EntrySessionState | null;
  conversationFrame?: EntryConversationFrame | null;
  activeUnknown?: string | null;
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countDiagnosticSignals(text: string) {
  const normalized = normalize(text);
  const signals = [
    "непрозрач",
    "собственник",
    "продажи",
    "лиды",
    "конверс",
    "команд",
    "хаос",
    "ручн",
    "процесс",
    "касс",
    "маржа",
    "прибыль",
    "не покупают",
    "неупак",
    "оценк",
    "сделк",
  ];

  return signals.filter((signal) => normalized.includes(signal)).length;
}

export function hasEnoughSignalForTelegramDiagnostic(
  params: TelegramDiagnosticThresholdParams,
) {
  if (params.mode !== "problem_first") {
    return false;
  }

  const frame = params.conversationFrame ?? params.session?.conversationFrame;
  const activeUnknown = params.activeUnknown ?? params.session?.activeUnknown;

  if (!frame || frame.goalHypotheses.length === 0) {
    return false;
  }

  if (activeUnknown === "goal" || activeUnknown === "main_symptom" || activeUnknown === "hypothesis_split") {
    return false;
  }

  if (frame.currentDiagnosticFocus === "goal_clarification" || frame.currentDiagnosticFocus === "symptom_collection") {
    return false;
  }

  const symptomCount = frame.symptomHints.length;
  const clarifyingCount = params.session?.clarifyingAnswers.length ?? 0;
  const signalCount = countDiagnosticSignals(params.rawText);
  const confidence = params.intent?.confidence ?? "low";

  if (symptomCount >= 2 && confidence !== "low") {
    return true;
  }

  if (symptomCount >= 1 && clarifyingCount >= 1 && signalCount >= 2) {
    return true;
  }

  if (frame.currentDiagnosticFocus === "constraint_probe" && symptomCount >= 1 && params.turnCount >= 2 && signalCount >= 3) {
    return true;
  }

  return false;
}
