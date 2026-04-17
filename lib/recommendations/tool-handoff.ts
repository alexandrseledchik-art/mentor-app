import { classifyHeuristicBundle } from "./bundles";

import type {
  BusinessArchitectureSource,
  RecommendationContext,
  RecommendationItem,
  SymptomToolMapEntry,
  ToolHandoff,
} from "./types";

const SCORE_SECTION_MAP: Record<string, string> = {
  owner: "КОНТУР СОБСТВЕННИКА",
  market: "ВНЕШНЯЯ СРЕДА",
  strategy: "СТРАТЕГИЯ",
  product: "СТРАТЕГИЯ",
  sales: "КОММЕРЦИЯ",
  operations: "ОПЕРАЦИОННАЯ МОДЕЛЬ",
  finance: "ФИНАНСЫ",
  team: "ЛЮДИ И ОРГАНИЗАЦИЯ",
  management: "УПРАВЛЕНИЕ И РИСКИ",
  tech: "ТЕХНОЛОГИИ И ДАННЫЕ",
  data: "ТЕХНОЛОГИИ И ДАННЫЕ",
};

const PATH_KEYWORDS: Record<string, string[]> = {
  sales: ["продаж", "выруч", "клиент"],
  product: ["продукт", "клиент", "ценност"],
  decisions: ["решен", "делег", "ответствен", "собственник"],
  growth_slowdown: ["рост", "выруч", "рын"],
  loss_of_control: ["управляем", "хаос", "контрол", "структур"],
  owner_overload: ["собственник", "операционк", "перегруз"],
  strategy: ["стратег", "видение", "приоритет"],
  cadence: ["ритм", "встреч", "управлен", "kpi"],
};

const TOOL_TITLE_ALIASES: Record<string, string[]> = {
  "аудит системы продаж": [
    "аудит продаж",
    "воронка продаж",
    "система планирования продаж",
  ],
  "матрица полномочий": [
    "матрица полномочия",
    "матрица полномочия",
    "decision matrix",
  ],
  "pestel + анализ конкурентов": [
    "pestel",
    "porter",
    "анализ конкурентов",
  ],
  "cjm + nps": [
    "customer journey map",
    "cjm",
    "nps",
  ],
  "диагностика оргструктуры + raci": [
    "raci",
    "матрица ролей и ответственности",
    "организационная структура",
  ],
  "аудит роли собственника": [
    "owner context canvas",
    "карта контекста собственника",
    "канва контекста собственника",
    "decision matrix для собственников",
    "financial mandate",
    "финансовый мандат собственников",
  ],
  "okr / kpi": [
    "okr",
    "objectives and key results",
    "kpi",
  ],
  "ansoff / blue ocean": [
    "ansoff",
    "blue ocean",
    "матрица ансоффа",
    "стратегия голубого океана",
  ],
  "stp + tier-сегментация клиентов": [
    "tier",
    "сегментация",
    "stp",
  ],
};

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/["«»()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasKeyword(value: string | null | undefined, keywords: string[]) {
  const normalized = normalize(value);
  return keywords.some((keyword) => normalized.includes(normalize(keyword)));
}

function getToolTitleCandidates(value: string | null | undefined) {
  const normalized = normalize(value);

  if (!normalized) {
    return [];
  }

  const splitParts = normalized
    .split(/[+,/]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);

  return Array.from(
    new Set([
      normalized,
      ...splitParts,
      ...(TOOL_TITLE_ALIASES[normalized] ?? []),
    ]),
  );
}

function findBestToolMatch(params: {
  source: BusinessArchitectureSource;
  title: string;
}) {
  const candidates = getToolTitleCandidates(params.title);

  if (candidates.length === 0) {
    return null;
  }

  const exact = params.source.knowledge.tools.find((item) =>
    candidates.some((candidate) => normalize(item.title_ru) === normalize(candidate)),
  );

  if (exact) {
    return exact;
  }

  let bestMatch:
    | {
        tool: BusinessArchitectureSource["knowledge"]["tools"][number];
        score: number;
      }
    | null = null;

  for (const tool of params.source.knowledge.tools) {
    const toolTitle = normalize(tool.title_ru);
    let score = 0;

    for (const candidate of candidates) {
      const normalizedCandidate = normalize(candidate);

      if (!normalizedCandidate) {
        continue;
      }

      if (toolTitle.includes(normalizedCandidate) || normalizedCandidate.includes(toolTitle)) {
        score = Math.max(score, normalizedCandidate.length);
      } else if (
        normalizedCandidate.length >= 4 &&
        normalizedCandidate
          .split(/\s+/)
          .every((token) => token.length < 3 || toolTitle.includes(token))
      ) {
        score = Math.max(score, Math.floor(normalizedCandidate.length * 0.75));
      }
    }

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = score > 0 ? { tool, score } : bestMatch;
    }
  }

  return bestMatch?.tool ?? null;
}

function createToolRecommendation(params: {
  source: BusinessArchitectureSource;
  toolTitle: string;
  reason: string;
  reasonCode: ToolHandoff["reasonCode"];
  sourceType: ToolHandoff["source"];
  confidence: ToolHandoff["confidence"];
  ctx: RecommendationContext;
}): ToolHandoff | null {
  const tool = findBestToolMatch({
    source: params.source,
    title: params.toolTitle,
  });

  if (!tool) {
    return null;
  }

  const bundleInfo = classifyHeuristicBundle(params.ctx);

  return {
    source: params.sourceType,
    confidence: params.confidence,
    reasonCode: params.reasonCode,
    humanReadableReason: params.reason,
    tool: {
      origin: "canonical",
      kind: "tool",
      title: tool.title_ru,
      description:
        tool.description_ru ??
        `Когда применять — ${tool.when_to_apply_ru ?? "по текущему кейсу"}.`,
      canonicalRef: {
        entityType: "tool",
        entityId: tool.id,
      },
      explanation: {
        why: params.reason,
        basedOn: {
          weakZones: bundleInfo.weakZoneLabels,
          strongestZone: bundleInfo.strongestZoneLabel,
          summarySignals: [params.ctx.summary.main_focus],
          contextSignals: [params.ctx.selectedPath, bundleInfo.bundle],
        },
        confidence: params.confidence,
      },
      details: {
        route: tool.section_ru ?? null,
        result: tool.result_ru ?? null,
        whenToApply: tool.when_to_apply_ru ?? null,
      },
    },
  };
}

function hasUsefulToolLayer(params: {
  description?: string | null;
  whenToApply?: string | null;
  result?: string | null;
}) {
  return [params.description, params.whenToApply, params.result].some(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
}

function isDuplicateOfCanonicalTitle(params: {
  canonicalTitle: string;
  toolTitle: string;
}) {
  const canonical = normalize(params.canonicalTitle);
  const tool = normalize(params.toolTitle);

  return canonical === tool || canonical.includes(tool) || tool.includes(canonical);
}

function resolveRouteLinkedTool(params: {
  source: BusinessArchitectureSource;
  canonical: RecommendationItem;
  ctx: RecommendationContext;
}): ToolHandoff | null {
  const exactTool = findBestToolMatch({
    source: params.source,
    title: params.canonical.title,
  });

  if (exactTool) {
    const duplicate = isDuplicateOfCanonicalTitle({
      canonicalTitle: params.canonical.title,
      toolTitle: exactTool.title_ru,
    });
    const usefulLayer = hasUsefulToolLayer({
      description: exactTool.description_ru,
      whenToApply: exactTool.when_to_apply_ru,
      result: exactTool.result_ru,
    });

    if (!duplicate || usefulLayer) {
      return createToolRecommendation({
        source: params.source,
        toolTitle: params.canonical.title,
        reasonCode: "route_tool_exact_match",
        sourceType: "route_linked",
        confidence: "high",
        reason: `Tool handoff added because canonical step «${params.canonical.title}» has a direct tool match in the catalog.`,
        ctx: params.ctx,
      });
    }
  }

  return null;
}

function resolveSymptomLinkedTool(params: {
  source: BusinessArchitectureSource;
  ctx: RecommendationContext;
}): ToolHandoff | null {
  const bundleInfo = classifyHeuristicBundle(params.ctx);
  const sectionCandidates = bundleInfo.weakZoneKeys
    .map((key) => SCORE_SECTION_MAP[key])
    .filter(Boolean);
  const keywords = PATH_KEYWORDS[params.ctx.selectedPath] ?? [];

  const symptomMatch = params.source.knowledge.symptom_tool_map.find(
    (item: SymptomToolMapEntry) =>
      sectionCandidates.includes(item.section_ru) &&
      (hasKeyword(item.symptom_ru, keywords) || hasKeyword(item.why_relevant_ru, keywords)),
  );

  if (!symptomMatch) {
    return null;
  }

  const recommendedToolCandidates = getToolTitleCandidates(symptomMatch.recommended_tool_ru);
  const resolvedTitle =
    recommendedToolCandidates.find((candidate) =>
      Boolean(
        findBestToolMatch({
          source: params.source,
          title: candidate,
        }),
      ),
    ) ?? symptomMatch.recommended_tool_ru;

  return createToolRecommendation({
    source: params.source,
    toolTitle: resolvedTitle,
    reasonCode: "symptom_tool_match",
    sourceType: "symptom_linked",
    confidence: "medium",
    reason: `Tool handoff added because symptom signal «${symptomMatch.symptom_ru}» maps to «${symptomMatch.recommended_tool_ru}».`,
    ctx: params.ctx,
  });
}

export function resolveToolHandoff(params: {
  source: BusinessArchitectureSource;
  canonical: RecommendationItem;
  ctx: RecommendationContext;
}): ToolHandoff | null {
  return (
    resolveRouteLinkedTool(params) ??
    resolveSymptomLinkedTool({
      source: params.source,
      ctx: params.ctx,
    }) ??
    null
  );
}
