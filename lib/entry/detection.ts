import type { EntryIntent, EntryMode } from "@/types/domain";

const TOOL_REQUEST_WORDS = [
  "инструмент",
  "шаблон",
  "матрица",
  "чеклист",
  "гайд",
  "tool",
  "template",
  "raci",
  "swot",
  "sipoc",
  "okr",
  "kpi",
];

const SPECIFIC_TOOL_WORDS = ["raci", "swot", "sipoc", "okr", "kpi", "юнит-экономика", "кассовый разрыв"];

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  sales: ["продаж", "лид", "ворон", "конверс", "сделк", "оффер"],
  management: ["хаос", "управл", "решени", "собственник", "делег", "приоритет"],
  team: ["команд", "роль", "роли", "ответствен", "найм", "люди"],
  finance: ["деньги", "финанс", "маржа", "кассов", "прибыль", "cac", "ltv"],
  operations: ["процесс", "операци", "срок", "ручн", "стык", "процессы"],
  growth: ["рост", "масштаб", "стагнац", "не растем", "не растет"],
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getMatchedDomains(normalizedText: string) {
  const scored = Object.entries(DOMAIN_KEYWORDS)
    .map(([domain, keywords]) => ({
      domain,
      score: keywords.reduce((count, keyword) => (normalizedText.includes(keyword) ? count + 1 : count), 0),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map((item) => item.domain);
}

export function detectEntryMode(rawText: string): EntryMode {
  const normalizedText = normalize(rawText);

  if (!normalizedText) {
    return "unclear";
  }

  const hasToolLanguage = TOOL_REQUEST_WORDS.some((item) => normalizedText.includes(item));
  const hasSpecificTool = SPECIFIC_TOOL_WORDS.some((item) => normalizedText.includes(item));

  if (hasSpecificTool) {
    return "specific_tool_request";
  }

  if (hasToolLanguage) {
    return normalizedText.split(" ").length <= 8 ? "tool_discovery" : "tool_discovery";
  }

  const hasPainLanguage =
    normalizedText.includes("проблем") ||
    normalizedText.includes("болит") ||
    normalizedText.includes("не работает") ||
    normalizedText.includes("не раст") ||
    normalizedText.includes("хаос") ||
    normalizedText.includes("просед");

  if (hasPainLanguage || getMatchedDomains(normalizedText).length > 0) {
    return "problem_first";
  }

  return "unclear";
}

export function detectEntryIntent(rawText: string, mode: EntryMode): EntryIntent {
  const normalizedText = normalize(rawText);
  const possibleDomains = getMatchedDomains(normalizedText).slice(0, 4);

  if (!normalizedText) {
    return {
      rawText,
      primaryIntent: "unclear",
      possibleDomains: [],
      confidence: "low",
    };
  }

  if (mode === "tool_discovery" || mode === "specific_tool_request") {
    return {
      rawText,
      primaryIntent: "tool_request",
      possibleDomains,
      confidence: possibleDomains.length > 0 ? "medium" : "low",
    };
  }

  const primaryIntent = possibleDomains[0];

  const mappedIntent: EntryIntent["primaryIntent"] =
    primaryIntent === "growth"
      ? "growth_problem"
      : primaryIntent === "sales"
        ? "sales_problem"
        : primaryIntent === "team"
          ? "team_problem"
          : primaryIntent === "management"
            ? "management_problem"
            : primaryIntent === "finance"
              ? "finance_problem"
              : primaryIntent === "operations"
                ? "operations_problem"
                : "unclear";

  const confidence =
    possibleDomains.length >= 2 ? "medium" : mappedIntent === "unclear" ? "low" : "high";

  return {
    rawText,
    primaryIntent: mappedIntent,
    possibleDomains,
    confidence,
  };
}

export function normalizeEntryText(value: string) {
  return normalize(value);
}
