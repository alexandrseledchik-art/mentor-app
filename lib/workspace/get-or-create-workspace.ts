import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/types/db";

import type { Workspace, WorkspaceRowLike } from "./types";

type WorkspaceRow = Database["public"]["Tables"]["workspaces"]["Row"];

function mapWorkspace(row: WorkspaceRowLike): Workspace {
  return {
    id: row.id,
    userId: row.user_id,
    activeCompanyId: row.active_company_id,
    activeDiagnosisSessionId: row.active_diagnosis_session_id,
    lastCompletedDiagnosisSessionId: row.last_completed_diagnosis_session_id,
    lastVisitedRoute: row.last_visited_route,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getWorkspaceByUserId(userId: string): Promise<Workspace | null> {
  const supabase = getSupabaseAdminClient();
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !workspace) {
    return null;
  }

  return mapWorkspace(workspace as WorkspaceRow);
}

export async function createWorkspaceForUser(userId: string): Promise<Workspace> {
  const supabase = getSupabaseAdminClient();
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .insert({
      user_id: userId,
      last_visited_route: "/onboarding",
    })
    .select("*")
    .single();

  if (error || !workspace) {
    throw error ?? new Error("Failed to create workspace.");
  }

  return mapWorkspace(workspace as WorkspaceRow);
}

export async function getOrCreateWorkspace(userId: string): Promise<Workspace> {
  const existing = await getWorkspaceByUserId(userId);

  if (existing) {
    return existing;
  }

  return createWorkspaceForUser(userId);
}
