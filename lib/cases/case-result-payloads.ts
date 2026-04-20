import { formatDiagnosticSummary } from "@/lib/diagnostic-core/format-summary";
import type { DiagnosticStructuredResult } from "@/lib/diagnostic-core/schema";

import type {
  CaseArtifactPayload,
  CaseToolRecommendationPayload,
  CompanySnapshotPayload,
} from "./types";

export function buildCaseArtifactPayload(result: DiagnosticStructuredResult): CaseArtifactPayload {
  const mainConstraint = result.constraints.main ?? "предварительное ограничение требует проверки";

  return {
    title: `Диагностический разбор: ${mainConstraint}`,
    summary: result.clientSummary,
    contentMarkdown: formatDiagnosticSummary(result),
  };
}

export function buildCompanySnapshotPayload(result: DiagnosticStructuredResult): CompanySnapshotPayload {
  return {
    currentGoal: result.goal.primary ?? result.goal.hypotheses[0] ?? null,
    mainConstraint: result.constraints.main,
    dominantSituation: result.dominantSituations[0]?.name ?? null,
    firstWaveSummary: result.firstWave.directions.join("; ") || null,
    toolRecommendations: result.toolRecommendations,
    summary: result.clientSummary,
  };
}

export function buildCaseToolRecommendationPayloads(
  result: DiagnosticStructuredResult,
): CaseToolRecommendationPayload[] {
  return result.toolRecommendations.slice(0, 4).map((tool) => ({
    toolTitle: tool.title,
    reasonNow: tool.reasonNow,
    taskSolved: tool.taskSolved,
    whyNotSecondary: tool.whyNotSecondary,
    toolSlug: null,
  }));
}

export function inferCaseConfidenceLevel(result: DiagnosticStructuredResult) {
  if (!result.constraints.main) {
    return "low";
  }

  if (result.confidenceMap.facts.length >= 2 && result.confidenceMap.workingHypotheses.length >= 1) {
    return "medium";
  }

  return "preliminary";
}
