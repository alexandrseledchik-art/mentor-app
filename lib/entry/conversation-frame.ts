import { stripUrls } from "@/lib/url-utils";
import type {
  EntryConversationFrame,
  EntryIntent,
  EntryMode,
  EntrySessionState,
} from "@/types/domain";

type BuildConversationFrameParams = {
  mode: EntryMode;
  intent: EntryIntent | null;
  rawText: string;
  session: EntrySessionState | null;
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(items: string[], limit: number) {
  return items.filter((item, index, array) => item && array.indexOf(item) === index).slice(0, limit);
}

function buildGoalHypotheses(text: string, intent: EntryIntent | null, previous: string[]) {
  const normalized = normalize(text);
  const hypotheses = [...previous];

  if (normalized.includes("продать бизнес") || normalized.includes("подготовить к продаже")) {
    hypotheses.unshift("Подготовить бизнес к продаже без потери стоимости и управляемости.");
  }

  if (normalized.includes("инвестор") || normalized.includes("инвести")) {
    hypotheses.unshift("Сделать бизнес понятным и убедительным для инвестора.");
  }

  if (normalized.includes("рост") || normalized.includes("масштаб")) {
    hypotheses.unshift("Убрать системное ограничение, мешающее росту.");
  }

  if (normalized.includes("прибыль") || normalized.includes("маржа")) {
    hypotheses.unshift("Восстановить прибыльность и финансовую управляемость.");
  }

  if (hypotheses.length === 0) {
    if (intent?.primaryIntent === "sales_problem") {
      hypotheses.push("Вернуть управляемость коммерческому контуру и восстановить продажи.");
    } else if (intent?.primaryIntent === "management_problem") {
      hypotheses.push("Убрать сбой в управлении и приоритетах, который тормозит бизнес.");
    } else if (intent?.primaryIntent === "operations_problem") {
      hypotheses.push("Вернуть операционную управляемость и снять системный сбой в процессах.");
    }
  }

  return unique(hypotheses, 4);
}

function buildSymptomHints(text: string, previous: string[]) {
  const normalized = normalize(stripUrls(text));
  const hints = [...previous];

  const symptomMatchers: Array<[string, string]> = [
    ["прозрач", "Непрозрачные цифры или слабая управленческая прозрачность."],
    ["собственник", "Критическая зависимость от собственника."],
    ["не покупают", "Бизнес трудно продать или он не выглядит готовым к сделке."],
    ["просел", "Есть просадка в одном из ключевых контуров."],
    ["лид", "Просадка в лидах или входящем спросе."],
    ["конверс", "Снижение конверсии в продажах."],
    ["хаос", "Высокий уровень управленческого или операционного хаоса."],
    ["ручн", "Слишком много ручного труда и неустойчивых процессов."],
    ["команд", "Есть напряжение в команде, ролях или ответственности."],
  ];

  for (const [needle, hint] of symptomMatchers) {
    if (normalized.includes(needle)) {
      hints.unshift(hint);
    }
  }

  return unique(hints, 6);
}

function determineCurrentDiagnosticFocus(params: {
  mode: EntryMode;
  intent: EntryIntent | null;
  goalHypotheses: string[];
  symptomHints: string[];
  previousFocus: string | null;
}) {
  if (params.goalHypotheses.length > 0 && params.symptomHints.length === 0) {
    return "symptom_collection";
  }

  if (params.previousFocus === "symptom_collection" && params.symptomHints.length > 0) {
    return "hypothesis_split";
  }

  if (params.symptomHints.length > 0 && params.intent?.confidence === "low") {
    return "hypothesis_split";
  }

  if (params.symptomHints.length > 0 && params.intent?.confidence !== "high") {
    return "constraint_probe";
  }

  if (params.intent?.primaryIntent === "tool_request") {
    return "tool_navigation";
  }

  return params.previousFocus ?? "goal_clarification";
}

function determineActiveUnknown(params: {
  mode: EntryMode;
  rawText: string;
  session: EntrySessionState | null;
  goalHypotheses: string[];
  symptomHints: string[];
}) {
  const normalized = normalize(stripUrls(params.rawText));
  const lastQuestionKey =
    params.session && "lastQuestionKey" in params.session
      ? params.session.lastQuestionKey
      : null;

  if (lastQuestionKey === "confirm_tool") {
    return "tool_confirmation";
  }

  if (lastQuestionKey === "sell_business_blocker" && normalized.length > 0) {
    return params.symptomHints.length > 0 ? "constraint_probe" : "main_symptom";
  }

  if (params.goalHypotheses.length === 0) {
    return "goal";
  }

  if (params.symptomHints.length === 0) {
    return "main_symptom";
  }

  if (params.mode === "problem_first" && params.session?.conversationFrame?.currentDiagnosticFocus === "symptom_collection") {
    return "hypothesis_split";
  }

  if (params.mode === "tool_discovery") {
    return "tool_goal";
  }

  return "constraint_probe";
}

export function buildConversationFrame(params: BuildConversationFrameParams): {
  conversationFrame: EntryConversationFrame;
  activeUnknown: string | null;
} {
  const previousFrame = params.session?.conversationFrame ?? {
    goalHypotheses: [],
    symptomHints: [],
    currentDiagnosticFocus: null,
  };

  const goalHypotheses = buildGoalHypotheses(
    params.rawText,
    params.intent,
    previousFrame.goalHypotheses,
  );
  const symptomHints = buildSymptomHints(params.rawText, previousFrame.symptomHints);
  const currentDiagnosticFocus = determineCurrentDiagnosticFocus({
    mode: params.mode,
    intent: params.intent,
    goalHypotheses,
    symptomHints,
    previousFocus: previousFrame.currentDiagnosticFocus,
  });
  const activeUnknown = determineActiveUnknown({
    mode: params.mode,
    rawText: params.rawText,
    session: params.session,
    goalHypotheses,
    symptomHints,
  });

  return {
    conversationFrame: {
      goalHypotheses,
      symptomHints,
      currentDiagnosticFocus,
    },
    activeUnknown,
  };
}
