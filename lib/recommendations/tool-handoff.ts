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

function createToolRecommendation(params: {
  source: BusinessArchitectureSource;
  toolTitle: string;
  reason: string;
  reasonCode: ToolHandoff["reasonCode"];
  sourceType: ToolHandoff["source"];
  confidence: ToolHandoff["confidence"];
  ctx: RecommendationContext;
}): ToolHandoff | null {
  const exactTool = params.source.knowledge.tools.find(
    (item) => normalize(item.title_ru) === normalize(params.toolTitle),
  );
  const keywordTool =
    exactTool ??
    params.source.knowledge.tools.find(
      (item) =>
        normalize(item.title_ru).includes(normalize(params.toolTitle)) ||
        normalize(params.toolTitle).includes(normalize(item.title_ru)),
    );
  const tool = keywordTool;

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
  const exactTool = params.source.knowledge.tools.find(
    (item) => normalize(item.title_ru) === normalize(params.canonical.title),
  );

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

  const keywordTool = params.source.knowledge.tools.find(
    (item) =>
      normalize(item.title_ru).includes(normalize(params.canonical.title)) ||
      normalize(params.canonical.title).includes(normalize(item.title_ru)),
  );

  if (!keywordTool) {
    return null;
  }

  const duplicate = isDuplicateOfCanonicalTitle({
    canonicalTitle: params.canonical.title,
    toolTitle: keywordTool.title_ru,
  });
  const usefulLayer = hasUsefulToolLayer({
    description: keywordTool.description_ru,
    whenToApply: keywordTool.when_to_apply_ru,
    result: keywordTool.result_ru,
  });

  if (duplicate && !usefulLayer) {
    return null;
  }

  return createToolRecommendation({
    source: params.source,
    toolTitle: keywordTool.title_ru,
    reasonCode: "route_tool_keyword_match",
    sourceType: "route_linked",
    confidence: "medium",
    reason: `Tool handoff added because canonical step «${params.canonical.title}» has a keyword-level match in the catalog.`,
    ctx: params.ctx,
  });
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

  return createToolRecommendation({
    source: params.source,
    toolTitle: symptomMatch.recommended_tool_ru.split("+")[0]?.trim() ?? symptomMatch.recommended_tool_ru,
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
