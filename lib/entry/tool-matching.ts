import "server-only";

import { getToolBySlug } from "@/lib/tools";

import type { EntryIntent, EntryMode, ToolConfidence, Tool } from "@/types/domain";

type ToolAliasConfig = {
  slug: string;
  aliases: string[];
  keywords: string[];
};

const TOOL_ALIAS_CONFIG: ToolAliasConfig[] = [
  {
    slug: "sales-funnel-audit",
    aliases: ["воронка продаж", "аудит воронки", "sales funnel", "воронка"],
    keywords: ["продаж", "лид", "конверс", "сделк", "ворон"],
  },
  {
    slug: "offer-clarity-template",
    aliases: ["оффер", "offer", "ценностное предложение", "предложение"],
    keywords: ["оффер", "ценност", "предложен", "позиционир", "выбрать вас"],
  },
  {
    slug: "channel-stability-check",
    aliases: ["канал", "каналы", "трафик", "channel stability"],
    keywords: ["канал", "трафик", "лидоген", "маркетинг", "источник лидов"],
  },
  {
    slug: "customer-interview-guide",
    aliases: ["custdev", "интервью с клиентами", "customer interview", "интервью"],
    keywords: ["клиент", "интервью", "обратн", "custdev", "исследован"],
  },
  {
    slug: "weekly-priority-board",
    aliases: ["приоритеты", "weekly board", "weekly priority", "доска приоритетов"],
    keywords: ["приоритет", "фокус", "хаос", "всё горит", "процесс", "процессы"],
  },
  {
    slug: "role-clarity-checklist",
    aliases: [
      "raci",
      "матрица ответственности",
      "роли и ответственность",
      "роли",
      "ответственность",
      "матрица ролей",
    ],
    keywords: ["роль", "роли", "ответствен", "владелец", "ownership", "делегирован"],
  },
  {
    slug: "unit-economics-sheet",
    aliases: ["юнит-экономика", "unit economics", "unit economics sheet", "ue"],
    keywords: ["маржа", "cac", "ltv", "юнит", "прибыльность"],
  },
  {
    slug: "cash-gap-check",
    aliases: ["кассовый разрыв", "cash gap", "cashflow", "денежный разрыв"],
    keywords: ["кассов", "денежн", "cash", "ликвидност", "платеж"],
  },
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countMatches(text: string, patterns: string[]) {
  return patterns.reduce((count, pattern) => (text.includes(pattern) ? count + 1 : count), 0);
}

export interface ToolMatchResult {
  tool: Tool | null;
  confidence: ToolConfidence;
  normalizedQuery?: string;
}

export async function matchToolFromText(
  rawText: string,
  _mode: EntryMode,
  intent: EntryIntent | null,
): Promise<ToolMatchResult> {
  const normalizedText = normalize(rawText);

  if (!normalizedText) {
    return { tool: null, confidence: "low" };
  }

  let bestConfig: ToolAliasConfig | null = null;
  let bestConfidence: ToolConfidence = "low";
  let bestScore = 0;

  for (const config of TOOL_ALIAS_CONFIG) {
    const normalizedAliases = config.aliases.map(normalize);
    const exactAlias = normalizedAliases.find(
      (alias) => normalizedText === alias || normalizedText.includes(` ${alias} `),
    );

    if (exactAlias) {
      bestConfig = config;
      bestConfidence = "high";
      bestScore = 100;
      break;
    }

    const aliasHits = countMatches(normalizedText, normalizedAliases);
    const keywordHits = countMatches(normalizedText, config.keywords.map(normalize));
    const domainBoost =
      intent?.possibleDomains.some((domain) =>
        config.keywords.some((keyword) => normalize(keyword).includes(domain)),
      )
        ? 1
        : 0;
    const score = aliasHits * 5 + keywordHits * 2 + domainBoost;

    if (score > bestScore) {
      bestConfig = config;
      bestScore = score;
      bestConfidence = score >= 5 ? "medium" : "low";
    }
  }

  if (!bestConfig || bestConfidence === "low") {
    return {
      tool: null,
      confidence: "low",
      normalizedQuery: normalizedText,
    };
  }

  const tool = await getToolBySlug(bestConfig.slug);

  if (!tool) {
    return {
      tool: null,
      confidence: "low",
      normalizedQuery: normalizedText,
    };
  }

  return {
    tool,
    confidence: bestConfidence,
    normalizedQuery: normalizedText,
  };
}

export async function suggestClosestAlternativeTool(
  rawText: string,
  intent: EntryIntent | null,
): Promise<Tool | null> {
  const normalizedText = normalize(rawText);

  if (!normalizedText) {
    return null;
  }

  const likelyOperations =
    normalizedText.includes("процесс") ||
    normalizedText.includes("хаос") ||
    intent?.primaryIntent === "operations_problem" ||
    intent?.primaryIntent === "management_problem";

  const likelyRoles =
    normalizedText.includes("роль") ||
    normalizedText.includes("raci") ||
    normalizedText.includes("ответствен") ||
    intent?.primaryIntent === "team_problem";

  if (likelyRoles) {
    return getToolBySlug("role-clarity-checklist");
  }

  if (likelyOperations) {
    return getToolBySlug("weekly-priority-board");
  }

  return null;
}

export function isAffirmativeAnswer(value: string) {
  const normalized = normalize(value);
  return ["да", "ага", "верно", "именно", "ok", "ок", "yes"].some((item) =>
    normalized.includes(item),
  );
}

export function isNegativeAnswer(value: string) {
  const normalized = normalize(value);
  return ["нет", "неа", "не совсем", "no"].some((item) => normalized.includes(item));
}

export function normalizeToolQuery(value: string) {
  return normalize(value);
}
