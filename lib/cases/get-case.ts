import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/server";

import { mapCaseRow } from "./mappers";
import type { BusinessCase } from "./types";

export async function getCaseById(caseId: string): Promise<BusinessCase | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase.from("cases").select("*").eq("id", caseId).maybeSingle();

  if (error) {
    throw new Error(`Failed to load case: ${error.message}`);
  }

  return data ? mapCaseRow(data) : null;
}
