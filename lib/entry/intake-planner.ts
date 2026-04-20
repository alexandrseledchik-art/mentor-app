import { POST_WEBSITE_SCREENING_REQUEST_KEY } from "@/lib/entry/constants";
import { stripUrls } from "@/lib/url-utils";
import type {
  EntryConversationFrame,
  EntryIntent,
  EntryMode,
  EntryRoutingDecision,
  EntrySessionState,
} from "@/types/domain";

type IntakePlannerParams = {
  mode: EntryMode;
  intent: EntryIntent | null;
  rawText: string;
  turnCount: number;
  session: EntrySessionState | null;
  conversationFrame?: EntryConversationFrame | null;
  activeUnknown?: string | null;
};

type IntakePlannerResult = {
  shouldAskBeforeDiagnosis: boolean;
  nextQuestion: EntryRoutingDecision["nextQuestion"];
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getWorkingText(rawText: string) {
  return normalize(stripUrls(rawText));
}

function includesAny(text: string, parts: string[]) {
  return parts.some((part) => text.includes(part));
}

function detectGoalSignal(text: string) {
  if (
    includesAny(text, [
      "продать бизнес",
      "продажа бизнеса",
      "подготовить к продаже",
      "сделка по продаже",
    ])
  ) {
    return "sell_business";
  }

  if (includesAny(text, ["инвестор", "инвести", "поднять раунд", "привлечь капитал"])) {
    return "raise_investment";
  }

  if (includesAny(text, ["рост", "вырасти", "масштаб", "масштабировать"])) {
    return "growth";
  }

  if (includesAny(text, ["прибыль", "маржа", "деньги", "кассов"])) {
    return "finance";
  }

  return "generic";
}

function hasSymptomSignal(text: string) {
  return includesAny(text, [
    "просел",
    "падает",
    "упал",
    "упала",
    "не работает",
    "хаос",
    "зависит",
    "нет",
    "непонятно",
    "непрозрач",
    "нестабиль",
    "ручн",
    "срыва",
    "застрял",
    "не покупают",
    "не упакован",
    "не могу оценить",
  ]);
}

function buildProblemQuestion(intent: EntryIntent | null, rawText: string) {
  const text = getWorkingText(rawText);
  const goalSignal = detectGoalSignal(text);

  if (goalSignal === "sell_business") {
    return {
      key: "sell_business_blocker",
      text: "Чтобы понять, что реально мешает продаже, уточните в 1–2 фразах: что сейчас главный стоп-фактор — непрозрачные цифры, зависимость от собственника, нестабильные продажи или неупакованность бизнеса для сделки?",
    };
  }

  if (goalSignal === "raise_investment") {
    return {
      key: "investment_blocker",
      text: "Чтобы понять, что мешает привлечению капитала, уточните: сейчас главный стоп-фактор в слабой экономике, непрозрачности данных, размытом позиционировании или в отсутствии управляемой системы?",
    };
  }

  if (intent?.possibleDomains.includes("sales")) {
    return {
      key: "sales_focus",
      text: "Чтобы не перепутать симптом с причиной, уточните: сейчас сильнее всего проседают лиды, конверсия в продажи, средний чек или сам оффер?",
    };
  }

  if (intent?.possibleDomains.includes("finance")) {
    return {
      key: "finance_focus",
      text: "Уточните, что сейчас болит сильнее: касса, маржа, управленческий учёт или непонимание экономики по направлениям?",
    };
  }

  if (intent?.possibleDomains.includes("team") || intent?.possibleDomains.includes("management")) {
    return {
      key: "management_focus",
      text: "Чтобы выйти на главное ограничение, уточните: где сейчас больше всего сбой — в ролях и ответственности, в принятии решений, в приоритетах или в ежедневной управляемости?",
    };
  }

  return {
    key: "diagnostic_focus",
    text: "Чтобы продолжить разбор по делу, уточните в 1–2 фразах: какой результат вы хотите получить и что сейчас сильнее всего этому мешает?",
  };
}

function buildToolQuestion() {
  return {
    key: "tool_goal",
    text: "Чтобы не увести вас в случайный инструмент, уточните в 1–2 фразах: какую задачу вы хотите решить в первую очередь?",
  };
}

function buildHypothesisSplitQuestion(intent: EntryIntent | null, rawText: string) {
  const text = getWorkingText(rawText);
  const goalSignal = detectGoalSignal(text);

  if (goalSignal === "sell_business") {
    return {
      key: "sell_business_hypothesis_split",
      text: "Чтобы не спутать симптом с реальным стоп-фактором продажи, уточните: сейчас сильнее мешают непрозрачные цифры, зависимость от собственника, слабая упаковка бизнеса для сделки или нестабильный коммерческий контур?",
    };
  }

  if (intent?.possibleDomains.includes("sales")) {
    return {
      key: "sales_hypothesis_split",
      text: "Чтобы развести рабочие гипотезы, уточните: проблема сейчас больше в слабом спросе, в падении конверсии, в неясном оффере или в сбое исполнения продаж?",
    };
  }

  if (intent?.possibleDomains.includes("management") || intent?.possibleDomains.includes("team")) {
    return {
      key: "management_hypothesis_split",
      text: "Чтобы не лечить всё сразу, уточните: главный сбой сейчас в ролях и ответственности, в принятии решений, в приоритетах собственника или в ежедневной управляемости?",
    };
  }

  if (intent?.possibleDomains.includes("finance")) {
    return {
      key: "finance_hypothesis_split",
      text: "Чтобы понять, где именно искать ограничение, уточните: боль сейчас в кассе, в марже, в непрозрачной экономике направлений или в слабом управленческом учёте?",
    };
  }

  return {
    key: "hypothesis_split",
    text: "Чтобы развести рабочие версии и не уйти в случайный сценарий, уточните: что сейчас сильнее всего мешает результату — спрос, исполнение, управляемость или прозрачность данных?",
  };
}

function buildUnclearQuestion() {
  return {
    key: "request_clarify",
    text: "Чтобы понять запрос без догадок, уточните в 1–2 фразах: какого результата вы хотите и что сейчас этому мешает?",
  };
}

export function planEntryIntake(params: IntakePlannerParams): IntakePlannerResult {
  const text = getWorkingText(params.rawText);
  const cameFromWebsiteScreening =
    params.session && "lastQuestionKey" in params.session
      ? params.session.lastQuestionKey === POST_WEBSITE_SCREENING_REQUEST_KEY
      : false;
  const activeUnknown = params.activeUnknown ?? params.session?.activeUnknown;
  const frame = params.conversationFrame ?? params.session?.conversationFrame;

  if (params.mode === "tool_discovery") {
    return {
      shouldAskBeforeDiagnosis: false,
      nextQuestion: buildToolQuestion(),
    };
  }

  if (params.mode === "problem_first") {
    const missingSymptomSignal = !hasSymptomSignal(text);

    if (activeUnknown === "goal" || (frame && frame.goalHypotheses.length === 0)) {
      return {
        shouldAskBeforeDiagnosis: true,
        nextQuestion: {
          key: "request_goal",
          text: "Чтобы не гадать о приоритетах, уточните в 1–2 фразах: какого результата вы хотите добиться в этой ситуации?",
        },
      };
    }

    if (activeUnknown === "main_symptom" || (frame && frame.symptomHints.length === 0 && missingSymptomSignal)) {
      return {
        shouldAskBeforeDiagnosis: true,
        nextQuestion: buildProblemQuestion(params.intent, params.rawText),
      };
    }

    if (
      activeUnknown === "hypothesis_split" ||
      frame?.currentDiagnosticFocus === "hypothesis_split"
    ) {
      return {
        shouldAskBeforeDiagnosis: true,
        nextQuestion: buildHypothesisSplitQuestion(params.intent, params.rawText),
      };
    }

    return {
      shouldAskBeforeDiagnosis:
        missingSymptomSignal &&
        (cameFromWebsiteScreening || params.turnCount <= 2),
      nextQuestion: buildProblemQuestion(params.intent, params.rawText),
    };
  }

  return {
    shouldAskBeforeDiagnosis: params.turnCount <= 1,
    nextQuestion: buildUnclearQuestion(),
  };
}
