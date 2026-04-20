import "server-only";

import { randomBytes } from "node:crypto";

import { getSupabaseAdminClient } from "@/lib/supabase/server";

import { mapCaseRow } from "./mappers";
import type { BusinessCase, CaseSource } from "./types";

export async function createCase(params: {
  userId: string;
  companyId?: string | null;
  workspaceId?: string | null;
  source?: CaseSource;
  initialMessage: string;
  currentStage?: string;
}): Promise<BusinessCase> {
  const supabase = getSupabaseAdminClient();
  const initialMessage = params.initialMessage.trim();

  if (!initialMessage) {
    throw new Error("Case initial message cannot be empty.");
  }

  const publicShareToken = randomBytes(18).toString("hex");

  const { data, error } = await supabase
    .from("cases")
    .insert({
      user_id: params.userId,
      company_id: params.companyId ?? null,
      workspace_id: params.workspaceId ?? null,
      source: params.source ?? "telegram",
      initial_message: initialMessage,
      public_share_token: publicShareToken,
      current_stage: params.currentStage ?? "quick_scan",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create case: ${error.message}`);
  }

  return mapCaseRow(data);
}
