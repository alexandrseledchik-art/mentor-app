import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/types/db";
import type { DiagnosisResultHistoryItem, DiagnosisResultSummary } from "@/types/domain";

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

export async function getResultHistoryByCompanyId(
  companyId: string,
): Promise<DiagnosisResultHistoryItem[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("result_snapshots")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return (data as ResultSnapshotRow[]).map(mapHistoryItem);
}
