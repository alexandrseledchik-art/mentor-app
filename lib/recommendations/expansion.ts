import { classifyHeuristicBundle } from "./bundles";

import type {
  BusinessArchitectureSource,
  ExpansionPolicyDecision,
  RecommendationContext,
  RecommendationItem,
  RouteStepEntry,
} from "./types";

const EXPECTED_BUNDLES_BY_PATH: Record<string, string[]> = {
  sales: ["commercial_product"],
  product: ["commercial_product", "strategy_market"],
  decisions: ["owner_governance", "operations_governance"],
  growth_slowdown: ["commercial_product", "strategy_market"],
  loss_of_control: ["operations_governance", "owner_governance"],
  owner_overload: ["owner_governance"],
  strategy: ["strategy_market"],
  cadence: ["operations_governance"],
};

function parseStepCode(stepCode: string | null | undefined) {
  const parsed = Number.parseFloat(stepCode ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}

function getPreviousRouteStep(params: {
  source: BusinessArchitectureSource;
  canonical: RecommendationItem;
}): RouteStepEntry | null {
  if (params.canonical.kind !== "route") {
    return null;
  }

  const route = params.canonical.details?.route ?? null;
  const stepCode = params.canonical.details?.stepCode ?? null;

  if (!route || !stepCode) {
    return null;
  }

  const routeSteps = params.source.product.route_steps
    .filter((item) => item.route_ru === route)
    .sort((a, b) => Number.parseFloat(a.step_code) - Number.parseFloat(b.step_code));
  const currentIndex = routeSteps.findIndex((item) => item.step_code === stepCode);

  return currentIndex > 0 ? routeSteps[currentIndex - 1] ?? null : null;
}

function isCrossDomainBridgeNeeded(ctx: RecommendationContext) {
  const bundle = classifyHeuristicBundle(ctx).bundle;
  const expectedBundles = EXPECTED_BUNDLES_BY_PATH[ctx.selectedPath] ?? [];

  return !expectedBundles.includes(bundle);
}

function isCanonicalTooLarge(canonical: RecommendationItem) {
  const stepCode = parseStepCode(canonical.details?.stepCode);

  if (stepCode === null) {
    return false;
  }

  return stepCode >= 5;
}

function buildIncludedReason(params: {
  crossDomainBridgeNeeded: boolean;
  canonicalTooLarge: boolean;
  previousStep: RouteStepEntry;
}) {
  if (params.crossDomainBridgeNeeded) {
    return {
      reasonCode: "cross_domain_bridge" as const,
      humanReadableReason: `Added intermediate_step because this case crosses domains and нужен мост через «${params.previousStep.tool_ru}».`,
    };
  }

  if (params.canonicalTooLarge) {
    return {
      reasonCode: "canonical_too_large" as const,
      humanReadableReason: `Added intermediate_step because canonical step is too large as a first move and нужен подготовительный шаг «${params.previousStep.tool_ru}».`,
    };
  }

  return {
    reasonCode: "preparatory_step_available" as const,
    humanReadableReason: `Added intermediate_step because a preparatory step exists before canonical route step: «${params.previousStep.tool_ru}».`,
  };
}

export function evaluateExpansionPolicy(params: {
  ctx: RecommendationContext;
  canonical: RecommendationItem;
  source: BusinessArchitectureSource;
}): ExpansionPolicyDecision[] {
  const previousStep = getPreviousRouteStep({
    source: params.source,
    canonical: params.canonical,
  });

  if (!previousStep) {
    return [
      {
        checked: true,
        included: false,
        reasonCode: "no_preparatory_step",
        humanReadableReason: "No preparatory route_step exists before canonical recommendation.",
      },
    ];
  }

  const canonicalTooLarge = isCanonicalTooLarge(params.canonical);
  const crossDomainBridgeNeeded = isCrossDomainBridgeNeeded(params.ctx);
  const duplicatesCanonical =
    previousStep.tool_ru.trim().toLowerCase() === params.canonical.title.trim().toLowerCase();

  if (duplicatesCanonical) {
    return [
      {
        checked: true,
        included: false,
        reasonCode: "duplicates_canonical",
        humanReadableReason:
          "Rejected because intermediate_step duplicates canonical recommendation.",
      },
    ];
  }

  if (!canonicalTooLarge && !crossDomainBridgeNeeded) {
    return [
      {
        checked: true,
        included: false,
        reasonCode: "canonical_already_specific",
        humanReadableReason:
          "Rejected because canonical recommendation is already specific enough.",
      },
    ];
  }

  const includedReason = buildIncludedReason({
    crossDomainBridgeNeeded,
    canonicalTooLarge,
    previousStep,
  });

  return [
    {
      checked: true,
      included: true,
      reasonCode: includedReason.reasonCode,
      humanReadableReason: includedReason.humanReadableReason,
    },
  ];
}

export function resolveInferredExpansions(params: {
  ctx: RecommendationContext;
  canonical: RecommendationItem;
  source: BusinessArchitectureSource;
  policy: ExpansionPolicyDecision[];
}): RecommendationItem[] {
  if (!params.policy.some((item) => item.included)) {
    return [];
  }

  const previousStep = getPreviousRouteStep({
    source: params.source,
    canonical: params.canonical,
  });

  if (!previousStep) {
    return [];
  }

  const bundleInfo = classifyHeuristicBundle(params.ctx);

  return [
    {
      origin: "inferred",
      kind: "intermediate_step",
      title: previousStep.tool_ru,
      description: `Подготовительный шаг перед «${params.canonical.title}».`,
      canonicalRef: {
        entityType: "route_step",
        entityId: previousStep.id,
      },
      explanation: {
        why:
          params.policy.find((item) => item.included)?.humanReadableReason ??
          "Intermediate step inferred from canonical route.",
        basedOn: {
          weakZones: bundleInfo.weakZoneLabels,
          strongestZone: bundleInfo.strongestZoneLabel,
          summarySignals: [params.ctx.summary.main_focus],
          contextSignals: [bundleInfo.bundle, params.ctx.selectedPath],
        },
        confidence: "medium",
      },
      details: {
        route: previousStep.route_ru,
        stepCode: previousStep.step_code,
        goal: previousStep.step_goal_ru,
        result: previousStep.step_result_ru,
      },
    },
  ];
}
