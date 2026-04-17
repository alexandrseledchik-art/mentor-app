import { classifyHeuristicBundle } from "./bundles";
import { resolveCanonicalRecommendation } from "./canonical";
import { composeHybridRecommendation } from "./compose";
import { evaluateExpansionPolicy, resolveInferredExpansions } from "./expansion";
import { getBusinessArchitectureSource } from "./json-source";
import { buildToolContext } from "./tool-context";
import { resolveToolHandoff } from "./tool-handoff";

import type {
  OrchestratedRecommendationResult,
  RecommendationContext,
} from "./types";

function logRecommendationEvent(event: string, payload: Record<string, unknown>) {
  console.info({
    layer: "hybrid_recommendations",
    event,
    ...payload,
  });
}

export async function buildHybridRecommendation(
  ctx: RecommendationContext,
  deps?: {
    getSource?: typeof getBusinessArchitectureSource;
    logEvent?: typeof logRecommendationEvent;
  },
): Promise<OrchestratedRecommendationResult> {
  const getSource = deps?.getSource ?? getBusinessArchitectureSource;
  const logEvent = deps?.logEvent ?? logRecommendationEvent;
  const bundleInfo = classifyHeuristicBundle(ctx);

  logEvent("hybrid_rec_input", {
    mode: ctx.mode,
    selectedPath: ctx.selectedPath,
    scores: ctx.scores,
    mainFocus: ctx.summary.main_focus,
    bundle: bundleInfo.bundle,
    weakZoneKeys: bundleInfo.weakZoneKeys,
    weakZoneLabels: bundleInfo.weakZoneLabels,
    strongestZoneKey: bundleInfo.strongestZoneKey,
    strongestZoneLabel: bundleInfo.strongestZoneLabel,
  });

  try {
    const source = await getSource();
    const canonicalResolution = resolveCanonicalRecommendation({ source, ctx });
    const canonical = canonicalResolution.recommendation;

    if (!canonical) {
      logEvent("canonical_resolution_failed", {
        mode: ctx.mode,
        selectedPath: ctx.selectedPath,
        bundle: canonicalResolution.trace.bundle,
        queryKey: canonicalResolution.trace.queryKey,
        resolutionPath: canonicalResolution.trace.resolutionPath,
        reason: "No canonical route_step/task/tool resolved.",
      });

      return {
        hybridRecommendation: null,
        fallbackRequired: true,
        fallbackReason: "canonical_resolution_failed",
        trace: canonicalResolution.trace,
      };
    }

    logEvent("hybrid_rec_canonical", {
      mode: ctx.mode,
      selectedPath: ctx.selectedPath,
      bundle: canonicalResolution.trace.bundle,
      queryKey: canonicalResolution.trace.queryKey,
      resolutionPath: canonicalResolution.trace.resolutionPath,
      origin: canonical.origin,
      kind: canonical.kind,
      canonicalRef: canonical.canonicalRef ?? null,
      title: canonical.title,
      details: canonical.details ?? null,
    });

    const policy = evaluateExpansionPolicy({
      ctx,
      canonical,
      source,
    });
    logEvent("hybrid_rec_policy", {
      mode: ctx.mode,
      selectedPath: ctx.selectedPath,
      bundle: canonicalResolution.trace.bundle,
      policy,
    });

    const expansions = resolveInferredExpansions({
      ctx,
      canonical,
      source,
      policy,
    });

    logEvent("hybrid_rec_expansion", {
      mode: ctx.mode,
      selectedPath: ctx.selectedPath,
      bundle: canonicalResolution.trace.bundle,
      included: expansions.length > 0,
      expansionCount: expansions.length,
      expansions: expansions.map((item) => ({
        origin: item.origin,
        kind: item.kind,
        title: item.title,
        canonicalRef: item.canonicalRef ?? null,
      })),
      policyReasonCode: policy[0]?.reasonCode ?? null,
      policyReason: policy[0]?.humanReadableReason ?? null,
    });

    const toolHandoff = resolveToolHandoff({
      source,
      canonical,
      ctx,
    });

    const toolContextResult = buildToolContext({
      ctx,
      handoff: toolHandoff,
    });

    const enrichedToolHandoff = toolHandoff
      ? {
          ...toolHandoff,
          toolContext: toolContextResult.toolContext,
          enrichmentMeta: toolContextResult.meta,
        }
      : null;

    logEvent("hybrid_rec_tool_handoff", {
      mode: ctx.mode,
      selectedPath: ctx.selectedPath,
      bundle: canonicalResolution.trace.bundle,
      included: Boolean(enrichedToolHandoff),
      source: enrichedToolHandoff?.source ?? null,
      reasonCode: enrichedToolHandoff?.reasonCode ?? "no_confident_tool_match",
      reason: enrichedToolHandoff?.humanReadableReason ?? "No confident tool handoff match.",
      tool: enrichedToolHandoff
        ? {
            title: enrichedToolHandoff.tool.title,
            canonicalRef: enrichedToolHandoff.tool.canonicalRef ?? null,
          }
        : null,
    });

    logEvent("tool_context_enrichment", {
      mode: ctx.mode,
      selectedPath: ctx.selectedPath,
      bundle: canonicalResolution.trace.bundle,
      included: toolContextResult.meta.included,
      toolTitle: enrichedToolHandoff?.tool.title ?? null,
      reasonCode: toolContextResult.meta.reasonCode,
      reason: toolContextResult.meta.humanReadableReason,
      usedDescription: toolContextResult.meta.usedDescription,
      usedWhenToApply: toolContextResult.meta.usedWhenToApply,
      usedResult: toolContextResult.meta.usedResult,
      usedBundleTemplate: toolContextResult.meta.usedBundleTemplate,
    });

    const hybridRecommendation = composeHybridRecommendation({
      canonical,
      canonicalReason: canonical.explanation.why,
      expansions,
      toolHandoff: enrichedToolHandoff,
      policy,
    });

    logEvent("hybrid_rec_composition", {
      mode: ctx.mode,
      selectedPath: ctx.selectedPath,
      bundle: canonicalResolution.trace.bundle,
      composition: hybridRecommendation.composition,
      primaryCanonicalRef: hybridRecommendation.primaryRecommendation.canonicalRef ?? null,
      expansionCount: hybridRecommendation.optionalExpansions.length,
    });

    return {
      hybridRecommendation,
      fallbackRequired: false,
      fallbackReason: null,
      trace: canonicalResolution.trace,
    };
  } catch (error) {
    logEvent("canonical_resolution_failed", {
      mode: ctx.mode,
      selectedPath: ctx.selectedPath,
      bundle: bundleInfo.bundle,
      reason: "Source loading or orchestration failure.",
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      hybridRecommendation: null,
      fallbackRequired: true,
      fallbackReason: "source_or_orchestration_failure",
      trace: {
        bundle: bundleInfo.bundle,
        resolutionPath: "fallback",
        queryKey: `${ctx.mode}:${ctx.selectedPath}`,
      },
    };
  }
}
