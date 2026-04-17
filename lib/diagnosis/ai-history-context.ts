import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/types/db";
import type {
  AiHistoryInterpretationContext,
  DiagnosisDimensionScore,
  DiagnosisResultSummary,
} from "@/types/domain";

type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
type ResultSnapshotRow = Database["public"]["Tables"]["result_snapshots"]["Row"];
const MAX_HISTORY_CONTEXT_SNAPSHOTS = 6;

function parseStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function parseDimensionScores(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<DiagnosisDimensionScore[]>((accumulator, item) => {
    if (
      item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      "dimension" in item &&
      "averageScore" in item &&
      typeof item.dimension === "string" &&
      typeof item.averageScore === "number"
    ) {
      accumulator.push({
        dimension: item.dimension,
        averageScore: item.averageScore,
      });
    }

    return accumulator;
  }, []);
}

function parseSummaryKey(value: unknown): DiagnosisResultSummary["key"] | null {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "key" in value &&
    (value.key === "low" || value.key === "medium" || value.key === "high")
  ) {
    return value.key;
  }

  return null;
}

export async function buildAiHistoryContextByCompanyId(
  companyId: string,
): Promise<AiHistoryInterpretationContext | null> {
  const supabase = getSupabaseAdminClient();
  const [{ data: company, error: companyError }, { data: snapshots, error: snapshotsError }] =
    await Promise.all([
      supabase.from("companies").select("*").eq("id", companyId).maybeSingle(),
      supabase
        .from("result_snapshots")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(MAX_HISTORY_CONTEXT_SNAPSHOTS),
    ]);

  if (companyError || snapshotsError || !company || !snapshots) {
    return null;
  }

  return {
    company: {
      id: (company as CompanyRow).id,
      name: (company as CompanyRow).name,
    },
    history: (snapshots as ResultSnapshotRow[])
      .slice()
      .reverse()
      .map((snapshot) => ({
      snapshotId: snapshot.id,
      createdAt: snapshot.created_at,
      overallScore: snapshot.overall_score,
      summaryKey: parseSummaryKey(snapshot.summary),
      weakestZones: parseStringArray(snapshot.weakest_zones),
      strongestZones: parseStringArray(snapshot.strongest_zones),
      dimensionScores: parseDimensionScores(snapshot.dimension_scores),
      })),
  };
}
