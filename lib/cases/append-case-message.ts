import "server-only";

import type { Json } from "@/types/db";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

import { mapCaseMessageRow } from "./mappers";
import type { CaseMessage, CaseMessageRole } from "./types";

export async function appendCaseMessage(params: {
  caseId: string;
  role: CaseMessageRole;
  text: string;
  metadata?: Record<string, unknown>;
}): Promise<CaseMessage> {
  const supabase = getSupabaseAdminClient();
  const text = params.text.trim();

  if (!text) {
    throw new Error("Case message text cannot be empty.");
  }

  const { data, error } = await supabase
    .from("case_messages")
    .insert({
      case_id: params.caseId,
      role: params.role,
      text,
      metadata: (params.metadata ?? {}) as Json,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to append case message: ${error.message}`);
  }

  return mapCaseMessageRow(data);
}
