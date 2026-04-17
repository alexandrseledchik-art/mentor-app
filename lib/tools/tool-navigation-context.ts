import "server-only";

import { buildAiResultContextFromSession, buildAiResultContextFromSnapshot } from "@/lib/diagnosis/ai-result-context";
import { getRecommendedToolsForSession, getRecommendedToolsForSnapshot } from "@/lib/tools/get-recommended-tools-for-result";
import { getToolBySlug } from "@/lib/tools/get-tool-by-title";
import type { ToolNavigationContext } from "@/types/domain";

async function buildToolNavigationContext(params: {
  sourceType: "live_result" | "snapshot";
  sourceId: string;
  toolSlug: string;
}) {
  const tool = await getToolBySlug(params.toolSlug);

  if (!tool) {
    return null;
  }

  const [resultContext, recommendedTools] = await Promise.all([
    params.sourceType === "snapshot"
      ? buildAiResultContextFromSnapshot(params.sourceId)
      : buildAiResultContextFromSession(params.sourceId),
    params.sourceType === "snapshot"
      ? getRecommendedToolsForSnapshot(params.sourceId)
      : getRecommendedToolsForSession(params.sourceId),
  ]);

  if (!resultContext) {
    return null;
  }

  const recommendedTool = recommendedTools.find((item) => item.slug === tool.slug);

  if (!recommendedTool) {
    return null;
  }

  const context: ToolNavigationContext = {
    company: {
      id: resultContext.company.id,
      name: resultContext.company.name,
      industry: resultContext.company.industry ?? null,
      teamSize: resultContext.company.teamSize ?? null,
    },
    result: {
      sourceType: resultContext.result.sourceType,
      overallScore: resultContext.result.overallScore,
      weakestZones: resultContext.result.weakestZones,
      strongestZones: resultContext.result.strongestZones,
    },
    tool: {
      slug: tool.slug,
      title: tool.title,
    },
    recommendationReason: recommendedTool.whyRecommended,
  };

  return context;
}

export async function buildToolNavigationContextFromSnapshot(params: {
  snapshotId: string;
  toolSlug: string;
}): Promise<ToolNavigationContext | null> {
  return buildToolNavigationContext({
    sourceType: "snapshot",
    sourceId: params.snapshotId,
    toolSlug: params.toolSlug,
  });
}

export async function buildToolNavigationContextFromSession(params: {
  sessionId: string;
  toolSlug: string;
}): Promise<ToolNavigationContext | null> {
  return buildToolNavigationContext({
    sourceType: "live_result",
    sourceId: params.sessionId,
    toolSlug: params.toolSlug,
  });
}
