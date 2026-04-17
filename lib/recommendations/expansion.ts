import "server-only";

import type {
  ExpansionPolicyDecision,
  RecommendationContext,
  RecommendationItem,
} from "./types";

export function evaluateExpansionPolicy(
  _ctx: RecommendationContext,
  _canonical: RecommendationItem,
): ExpansionPolicyDecision[] {
  return [
    {
      checked: true,
      included: false,
      reason: "Phase 1A: expansion disabled by design.",
    },
  ];
}

export function resolveInferredExpansions(_params: {
  ctx: RecommendationContext;
  canonical: RecommendationItem;
  policy: ExpansionPolicyDecision[];
}): RecommendationItem[] {
  return [];
}
