import "server-only";

import type {
  ExpansionPolicyDecision,
  HybridRecommendation,
  RecommendationItem,
} from "./types";

export function composeHybridRecommendation(params: {
  canonical: RecommendationItem;
  canonicalReason: string;
  expansions: RecommendationItem[];
  policy: ExpansionPolicyDecision[];
}): HybridRecommendation {
  return {
    composition: params.expansions.length > 0 ? "canonical_plus_inferred" : "canonical_only",
    primaryRecommendation: params.canonical,
    optionalExpansions: params.expansions,
    reasoning: {
      canonicalReason: params.canonicalReason,
      expansionReasonSummary:
        params.expansions.length > 0 ? "Expansion included." : null,
    },
    expansionPolicy: params.policy,
  };
}
