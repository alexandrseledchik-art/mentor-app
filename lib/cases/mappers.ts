import type { Database, Json } from "@/types/db";

import type { BusinessCase, CaseMessage, CaseSource, CaseStatus } from "./types";

type CaseRow = Database["public"]["Tables"]["cases"]["Row"];
type CaseMessageRow = Database["public"]["Tables"]["case_messages"]["Row"];

export function mapCaseRow(row: CaseRow): BusinessCase {
  return {
    id: row.id,
    userId: row.user_id,
    companyId: row.company_id,
    workspaceId: row.workspace_id,
    source: row.source as CaseSource,
    status: row.status as CaseStatus,
    initialMessage: row.initial_message,
    currentStage: row.current_stage,
    turnCount: row.turn_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

export function mapCaseMessageRow(row: CaseMessageRow): CaseMessage {
  return {
    id: row.id,
    caseId: row.case_id,
    role: row.role as CaseMessage["role"],
    text: row.text,
    metadata: jsonObject(row.metadata),
    createdAt: row.created_at,
  };
}

function jsonObject(value: Json): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return {};
  }

  return value as Record<string, unknown>;
}
