import type { DiagnosisChatContext, DiagnosisChatMode } from "@/types/domain";

export type RecommendationOrigin = "canonical" | "inferred";
export type RecommendationComposition = "canonical_only" | "canonical_plus_inferred";
export type HeuristicBundle =
  | "owner_governance"
  | "commercial_product"
  | "operations_governance"
  | "strategy_market"
  | "mixed";

export type RecommendationKind =
  | "route"
  | "task"
  | "tool"
  | "intermediate_step"
  | "symptom_hypothesis"
  | "route_hint"
  | "combined_route"
  | "sequence_adjustment";

export type CanonicalEntityType =
  | "route_step"
  | "navigator_task"
  | "tool"
  | "symptom_tool_map"
  | "framework_entity"
  | "transformation_entity";

export interface CanonicalRef {
  entityType: CanonicalEntityType;
  entityId: string;
}

export interface RecommendationExplanation {
  why: string;
  basedOn: {
    weakZones?: string[];
    strongestZone?: string | null;
    summarySignals?: string[];
    contextSignals?: string[];
  };
  confidence?: "high" | "medium" | "low";
}

export interface RecommendationItem {
  origin: RecommendationOrigin;
  kind: RecommendationKind;
  title: string;
  description?: string;
  canonicalRef?: CanonicalRef;
  explanation: RecommendationExplanation;
  details?: {
    route?: string | null;
    stepCode?: string | null;
    goal?: string | null;
    result?: string | null;
    nextStepGoal?: string | null;
  };
}

export interface ExpansionPolicyDecision {
  checked: boolean;
  included: boolean;
  reasonCode:
    | "no_preparatory_step"
    | "duplicates_canonical"
    | "canonical_already_specific"
    | "cross_domain_bridge"
    | "canonical_too_large"
    | "preparatory_step_available";
  humanReadableReason: string;
}

export interface RecommendationReasoning {
  canonicalReason: string;
  expansionReasonSummary?: string | null;
}

export interface HybridRecommendation {
  composition: RecommendationComposition;
  primaryRecommendation: RecommendationItem;
  optionalExpansions: RecommendationItem[];
  reasoning: RecommendationReasoning;
  expansionPolicy: ExpansionPolicyDecision[];
}

export interface RouteStepEntry {
  id: string;
  route_ru: string;
  route_description_ru: string;
  step_code: string;
  tool_ru: string;
  step_goal_ru: string;
  step_result_ru: string;
  participants_ru?: string;
  source_row?: number;
}

export interface NavigatorTaskEntry {
  id: string;
  section_ru: string;
  task_ru: string;
  tools_sequence_ru: string;
  when_to_apply_ru: string;
  expected_result_ru: string;
  typical_duration_ru?: string;
  source_row?: number;
}

export interface KnowledgeToolEntry {
  id: string;
  title_ru: string;
  description_ru: string;
  when_to_apply_ru?: string;
  result_ru?: string;
  section_ru?: string;
  url?: string;
}

export interface BusinessArchitectureSource {
  framework: {
    entities: unknown[];
    transformation_entities: unknown[];
  };
  knowledge: {
    tools: KnowledgeToolEntry[];
    symptom_tool_map: unknown[];
  };
  product: {
    navigator_tasks: NavigatorTaskEntry[];
    route_steps: RouteStepEntry[];
  };
}

export interface RecommendationContext {
  mode: DiagnosisChatMode;
  selectedPath: string;
  company: DiagnosisChatContext["company"];
  scores: DiagnosisChatContext["scores"];
  summary: DiagnosisChatContext["summary"];
}

export interface HeuristicBundleResult {
  bundle: HeuristicBundle;
  weakZoneKeys: string[];
  weakZoneLabels: string[];
  strongestZoneKey: string | null;
  strongestZoneLabel: string | null;
}

export interface CanonicalResolutionTrace {
  bundle: HeuristicBundle;
  resolutionPath: "route_step" | "navigator_task" | "tool" | "fallback";
  queryKey: string;
}

export interface OrchestratedRecommendationResult {
  hybridRecommendation: HybridRecommendation | null;
  fallbackRequired: boolean;
  fallbackReason: string | null;
  trace?: CanonicalResolutionTrace | null;
}
