import type {
  HeuristicBundle,
  HeuristicBundleResult,
  RecommendationContext,
} from "./types";

const SCORE_LABELS: Record<string, string> = {
  owner: "роль собственника",
  market: "внешняя среда и рынок",
  strategy: "стратегия и направление",
  product: "продукт",
  sales: "продажи и маркетинг",
  operations: "операции",
  finance: "финансы",
  team: "команда",
  management: "управление и принятие решений",
  tech: "технологии",
  data: "данные и аналитика",
};

const BUNDLE_KEY_WEIGHTS: Record<HeuristicBundle, Record<string, number>> = {
  owner_governance: {
    owner: 3,
    management: 3,
    team: 1,
  },
  commercial_product: {
    sales: 3,
    product: 3,
    finance: 1,
  },
  operations_governance: {
    operations: 3,
    management: 2,
    tech: 1,
    data: 1,
  },
  strategy_market: {
    strategy: 3,
    market: 3,
    product: 1,
  },
  mixed: {},
};

const BUNDLE_FOCUS_KEYWORDS: Record<
  Exclude<HeuristicBundle, "mixed">,
  string[]
> = {
  owner_governance: ["собственник", "решен", "делег", "полномоч", "управлен"],
  commercial_product: ["продаж", "выруч", "продукт", "клиент", "коммерц"],
  operations_governance: ["операц", "ритм", "управляем", "контрол", "регуляр"],
  strategy_market: ["стратег", "рынок", "фокус", "направлен", "приоритет"],
};

function getSortedScores(ctx: RecommendationContext) {
  return Object.entries(ctx.scores)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number")
    .sort((a, b) => a[1] - b[1]);
}

function getBundleScore(params: {
  bundle: Exclude<HeuristicBundle, "mixed">;
  weakZoneKeys: string[];
  mainFocus: string;
}) {
  const weights = BUNDLE_KEY_WEIGHTS[params.bundle];
  const weakScore = params.weakZoneKeys.reduce(
    (sum, key) => sum + (weights[key] ?? 0),
    0,
  );
  const focusScore = BUNDLE_FOCUS_KEYWORDS[params.bundle].some((keyword) =>
    params.mainFocus.includes(keyword),
  )
    ? 1
    : 0;

  return weakScore + focusScore;
}

export function classifyHeuristicBundle(
  ctx: RecommendationContext,
): HeuristicBundleResult {
  const sortedScores = getSortedScores(ctx);
  const weakZoneKeys = sortedScores.slice(0, 2).map(([key]) => key);
  const weakZoneLabels = weakZoneKeys.map((key) => SCORE_LABELS[key] ?? key);
  const strongestZoneKey = sortedScores.at(-1)?.[0] ?? null;
  const strongestZoneLabel = strongestZoneKey
    ? SCORE_LABELS[strongestZoneKey] ?? strongestZoneKey
    : null;
  const mainFocus = ctx.summary.main_focus.toLowerCase();

  const bundleScores = (
    ["owner_governance", "commercial_product", "operations_governance", "strategy_market"] as const
  ).map((bundle) => ({
    bundle,
    score: getBundleScore({
      bundle,
      weakZoneKeys,
      mainFocus,
    }),
  }));

  bundleScores.sort((a, b) => b.score - a.score);
  const top = bundleScores[0];
  const second = bundleScores[1];

  const bundle =
    !top || top.score < 3 || (second && top.score === second.score)
      ? "mixed"
      : top.bundle;

  return {
    bundle,
    weakZoneKeys,
    weakZoneLabels,
    strongestZoneKey,
    strongestZoneLabel,
  };
}

export function getScoreLabel(key: string) {
  return SCORE_LABELS[key] ?? key;
}
