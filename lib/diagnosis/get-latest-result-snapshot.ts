import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/types/db";
import type {
  DiagnosisDimensionScore,
  DiagnosisResultHistoryItem,
  DiagnosisResultSummary,
  ResultSnapshotDetail,
} from "@/types/domain";

type ResultSnapshotRow = Database["public"]["Tables"]["result_snapshots"]["Row"];

function parseSummaryKey(value: ResultSnapshotRow["summary"]): DiagnosisResultSummary["key"] | null {
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

function parseStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function parseDimensionScores(value: ResultSnapshotRow["dimension_scores"]) {
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

function parseSummary(value: ResultSnapshotRow["summary"]): DiagnosisResultSummary | null {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "key" in value &&
    "title" in value &&
    "description" in value &&
    "strengths" in value &&
    "risks" in value &&
    (value.key === "low" || value.key === "medium" || value.key === "high") &&
    typeof value.title === "string" &&
    typeof value.description === "string"
  ) {
    return {
      key: value.key,
      title: value.title,
      description: value.description,
      strengths: parseStringArray(value.strengths),
      risks: parseStringArray(value.risks),
    };
  }

  return null;
}

function parseRecommendedTools(value: ResultSnapshotRow["recommended_tools"]) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<Array<{ title: string; whyRecommended: string }>>((accumulator, item) => {
    if (
      item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      "title" in item &&
      "whyRecommended" in item &&
      typeof item.title === "string" &&
      typeof item.whyRecommended === "string"
    ) {
      accumulator.push({
        title: item.title,
        whyRecommended: item.whyRecommended,
      });
    }

    return accumulator;
  }, []);
}

function mapHistoryItem(row: ResultSnapshotRow): DiagnosisResultHistoryItem {
  return {
    snapshotId: row.id,
    diagnosisSessionId: row.diagnosis_session_id,
    createdAt: row.created_at,
    overallScore: row.overall_score,
    summaryKey: parseSummaryKey(row.summary),
    weakestZones: parseStringArray(row.weakest_zones),
    strongestZones: parseStringArray(row.strongest_zones),
  };
}

function mapSnapshotDetail(row: ResultSnapshotRow): ResultSnapshotDetail | null {
  const summary = parseSummary(row.summary);

  if (!summary) {
    return null;
  }

  return {
    snapshotId: row.id,
    diagnosisSessionId: row.diagnosis_session_id,
    createdAt: row.created_at,
    overallScore: row.overall_score,
    dimensionScores: parseDimensionScores(row.dimension_scores),
    weakestZones: parseStringArray(row.weakest_zones),
    strongestZones: parseStringArray(row.strongest_zones),
    summary,
    recommendedTools: parseRecommendedTools(row.recommended_tools),
  };
}

export async function getLatestResultSnapshotByCompanyId(
  companyId: string,
): Promise<DiagnosisResultHistoryItem | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("result_snapshots")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapHistoryItem(data as ResultSnapshotRow);
}

export async function getResultSnapshotById(
  snapshotId: string,
): Promise<ResultSnapshotDetail | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("result_snapshots")
    .select("*")
    .eq("id", snapshotId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapSnapshotDetail(data as ResultSnapshotRow);
}
