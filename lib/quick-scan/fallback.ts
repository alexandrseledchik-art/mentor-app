import type { QuickScanInput, QuickScanResult } from "./schema";

function detectLikelyArea(rawInput: string) {
  const text = rawInput.toLowerCase();

  if (text.includes("продаж") || text.includes("клиент") || text.includes("лид")) {
    return "Коммерция и продажи";
  }

  if (text.includes("команд") || text.includes("роль") || text.includes("ответствен")) {
    return "Команда и ответственность";
  }

  if (text.includes("деньг") || text.includes("касс") || text.includes("прибыл")) {
    return "Финансы и управленческий учёт";
  }

  if (text.includes("хаос") || text.includes("процесс") || text.includes("ручн")) {
    return "Операции и управляемость";
  }

  return "Управляемость бизнеса";
}

export function buildQuickScanFallback(input: QuickScanInput): QuickScanResult {
  const likelyArea = detectLikelyArea(input.rawInput);
  const hasVeryShortInput = input.rawInput.trim().length < 40;

  return {
    inputType: input.inputType,
    preliminarySummary: hasVeryShortInput
      ? "По текущему короткому описанию можно сделать только предварительный скрининг: данных пока мало, но уже можно выделить вероятную зону потерь и следующий вопрос."
      : "По описанию видно несколько возможных зон, где бизнес может терять деньги, время или управляемость. Это предварительная версия, которую нужно уточнить перед полноценным диагностическим выводом.",
    likelyLossZones: [
      {
        area: likelyArea,
        whyLikely: "Именно эта зона чаще всего становится источником потерь, когда в запросе есть признаки просадки результата, хаоса, ручного управления или неясного приоритета.",
        confidence: hasVeryShortInput ? "low" : "medium",
      },
      {
        area: "Данные и прозрачность управления",
        whyLikely: "Без ясных показателей трудно отличить симптом от ограничения и выбрать первый управленческий шаг.",
        confidence: "low",
      },
    ],
    constraintVersions: [
      {
        constraint: `Недостаточно управляемый контур: ${likelyArea.toLowerCase()}`,
        basis: "Во входе есть сигнал проблемы, но пока не хватает фактов, чтобы доказать корневое ограничение.",
        confidence: hasVeryShortInput ? "low" : "medium",
      },
      {
        constraint: "Недостаток прозрачности: неясно, где именно теряются деньги, время или ответственность.",
        basis: "Если в бизнесе нет измеримого разреза по проблеме, команда может лечить симптомы вместо причины.",
        confidence: "low",
      },
    ],
    firstWaveCandidate: {
      direction: `Уточнить и стабилизировать контур «${likelyArea}»`,
      whyThisFirst: "Сначала нужно подтвердить, что именно эта зона является ограничением, и только потом выбирать инструменты или масштабировать действия.",
    },
    toolCandidates: [
      {
        title: "Карта ограничений",
        whyRelevantNow: "Помогает отделить симптомы от главного узкого места и не распыляться на всё сразу.",
      },
      {
        title: "Аудит управленческих показателей",
        whyRelevantNow: "Помогает понять, какие данные нужны, чтобы подтвердить или отбросить текущую версию ограничения.",
      },
    ],
    clarificationQuestion: {
      text: "Что сейчас сильнее всего болит: продажи, касса, команда, процессы или решения собственника?",
      whyItMatters: "Ответ поможет отличить главное ограничение от вторичных симптомов и выбрать первую волну действий.",
    },
    disclaimer: "Это предварительный скрининг по минимальному контексту, а не финальный диагноз. Для уверенного вывода нужно подтвердить факты и уточнить ограничения.",
  };
}
