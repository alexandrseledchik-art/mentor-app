import type { EntryHypothesis, EntryIntent } from "@/types/domain";

const DOMAIN_LABELS: Record<string, string> = {
  sales: "продажи",
  team: "команда и роли",
  management: "управление и решения",
  finance: "финансы",
  operations: "процессы и операционка",
  growth: "рост",
};

const INTENT_SUMMARIES: Record<EntryIntent["primaryIntent"], string> = {
  growth_problem: "Похоже, проблема описана как торможение роста, но корневая причина пока неочевидна.",
  sales_problem: "Похоже, основное напряжение сейчас проявляется в продажах и коммерческом контуре.",
  team_problem: "Похоже, проблема может сидеть в команде, ролях и распределении ответственности.",
  management_problem: "Похоже, основное ограничение может быть в управлении, приоритетах и принятии решений.",
  finance_problem: "Похоже, вопрос упирается в финансовую управляемость и экономику.",
  operations_problem: "Похоже, основной сбой может быть в процессах и операционной управляемости.",
  tool_request: "Похоже, вы хотите быстро выйти на конкретный инструмент, но сначала важно понять, какой контур он должен закрыть.",
  unclear: "Пока сигнал слишком общий, поэтому гипотеза здесь только предварительная.",
};

export function buildEntryHypothesis(intent: EntryIntent): EntryHypothesis {
  const likelyAreas = (intent.possibleDomains.length > 0
    ? intent.possibleDomains
    : ["management", "operations"]
  ).slice(0, 4).map((item) => DOMAIN_LABELS[item] ?? item);

  return {
    summary: INTENT_SUMMARIES[intent.primaryIntent],
    likelyAreas,
    uncertaintyNote:
      intent.confidence === "high"
        ? "Это всё ещё не диагноз, а только рабочая гипотеза по вашему описанию."
        : "Это предварительная гипотеза, а не вывод. Лучше быстро уточнить фокус и уже потом вести вас в нужный структурный сценарий.",
  };
}
