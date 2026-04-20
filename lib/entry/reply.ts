import "server-only";

import type {
  EntryHypothesis,
  EntryRoutingDecision,
  EntrySessionState,
  TelegramEntryReply,
} from "@/types/domain";

function formatHypothesis(hypothesis: EntryHypothesis | null) {
  if (!hypothesis) {
    return null;
  }

  return [
    hypothesis.summary,
    `Предварительно это может затрагивать: ${hypothesis.likelyAreas.join(", ")}.`,
    hypothesis.uncertaintyNote,
  ].join(" ");
}

export function buildTelegramEntryReply(params: {
  session: EntrySessionState;
  decision: EntryRoutingDecision;
  hypothesis: EntryHypothesis | null;
}): TelegramEntryReply {
  const { session, decision, hypothesis } = params;
  const hypothesisText = formatHypothesis(hypothesis);

  if (decision.action === "ask_question" || decision.action === "confirm_tool_then_route") {
    return {
      text: [
        session.entryMode === "problem_first" && hypothesisText
          ? hypothesisText
          : "Понял запрос. Чтобы не увести вас в случайный сценарий, уточню только один момент.",
        decision.nextQuestion?.text ?? "Уточните, пожалуйста, что для вас сейчас главное.",
      ].join("\n\n"),
      stage: "clarifying",
    };
  }

  if (decision.action === "route_to_tool" && decision.toolSuggestion) {
    return {
      text: [
        `Похоже, лучший следующий шаг — инструмент «${decision.toolSuggestion.title}».`,
        decision.reason,
        "Сначала посмотрите, зачем он нужен именно вам, а затем открывайте его уже в Mini App.",
      ].join("\n\n"),
      cta: {
        label: "Открыть инструмент",
        url: decision.toolSuggestion.url,
      },
      stage: "ready_for_routing",
    };
  }

  if (decision.action === "route_to_website_screening") {
    return {
      text: [
        "Вижу, что вы дали только сайт. По нему можно сделать внешний скрининг, но не честный диагноз бизнеса.",
        "Сначала покажу, что видно снаружи: позиционирование, сильные стороны, зоны для проверки и границы того, что по сайту утверждать нельзя.",
      ].join("\n\n"),
      stage: "ready_for_routing",
    };
  }

  return {
    text: [
      hypothesisText ?? "По текущему описанию лучше не угадывать инструмент в чате.",
      "Лучший следующий шаг — короткая диагностика в Mini App. Она быстро отделит симптом от корневого ограничения и уже после этого даст точный маршрут.",
    ].join("\n\n"),
    cta: {
      label: "Пройти диагностику",
      url:
        decision.toolSuggestion?.url ??
        "/diagnosis?source=telegram_entry",
    },
    stage: "ready_for_routing",
  };
}
