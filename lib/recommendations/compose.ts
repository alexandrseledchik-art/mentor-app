import type {
  ExpansionPolicyDecision,
  HybridRecommendation,
  RecommendationItem,
  ToolHandoff,
} from "./types";

export function composeHybridRecommendation(params: {
  canonical: RecommendationItem;
  canonicalReason: string;
  expansions: RecommendationItem[];
  toolHandoff?: ToolHandoff | null;
  policy: ExpansionPolicyDecision[];
}): HybridRecommendation {
  return {
    composition: params.expansions.length > 0 ? "canonical_plus_inferred" : "canonical_only",
    primaryRecommendation: params.canonical,
    optionalExpansions: params.expansions,
    toolHandoff: params.toolHandoff ?? null,
    reasoning: {
      canonicalReason: params.canonicalReason,
      expansionReasonSummary: params.expansions[0]?.explanation.why ?? null,
      toolHandoffReasonSummary: params.toolHandoff?.humanReadableReason ?? null,
    },
    expansionPolicy: params.policy,
  };
}
