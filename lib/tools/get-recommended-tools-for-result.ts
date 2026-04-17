import "server-only";

import { buildAiResultContextFromSession, buildAiResultContextFromSnapshot } from "@/lib/diagnosis/ai-result-context";
import { getToolByTitle } from "@/lib/tools/get-tool-by-title";
import type { ResultRecommendedToolItem } from "@/types/domain";

async function normalizeRecommendedTools(
  recommendedTools: Array<{ title: string; whyRecommended: string }>,
): Promise<ResultRecommendedToolItem[]> {
  const resolved: ResultRecommendedToolItem[] = [];

  for (const item of recommendedTools) {
    const tool = await getToolByTitle(item.title);

    if (!tool) {
      continue;
    }

    if (resolved.some((existing) => existing.slug === tool.slug)) {
      continue;
    }

    resolved.push({
      slug: tool.slug,
      title: tool.title,
      whyRecommended: item.whyRecommended,
    });
  }

  return resolved;
}

export async function getRecommendedToolsForSnapshot(
  snapshotId: string,
): Promise<ResultRecommendedToolItem[]> {
  const context = await buildAiResultContextFromSnapshot(snapshotId);

  if (!context) {
    return [];
  }

  return normalizeRecommendedTools(context.result.recommendedTools);
}

export async function getRecommendedToolsForSession(
  sessionId: string,
): Promise<ResultRecommendedToolItem[]> {
  const context = await buildAiResultContextFromSession(sessionId);

  if (!context) {
    return [];
  }

  return normalizeRecommendedTools(context.result.recommendedTools);
}
