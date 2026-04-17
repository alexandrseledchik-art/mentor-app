import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/workspace/get-current-app-user";
import { getOrCreateWorkspace } from "@/lib/workspace/get-or-create-workspace";

export function logAiRouteEvent(
  event: string,
  details: Record<string, unknown> = {},
) {
  console.error("AI RESULT ROUTE:", {
    event,
    ...details,
  });
}

export async function resolveActiveCompanyAccess() {
  const user = await getCurrentAppUser();

  if (!user) {
    return { status: "unauthorized" as const };
  }

  const workspace = await getOrCreateWorkspace(user.id);

  if (!workspace.activeCompanyId) {
    return { status: "no_company" as const };
  }

  return {
    status: "ok" as const,
    userId: user.id,
    activeCompanyId: workspace.activeCompanyId,
  };
}

export async function verifyAccessibleSnapshot(snapshotId: string, companyId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("result_snapshots")
    .select("id, company_id")
    .eq("id", snapshotId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !data) {
    logAiRouteEvent("snapshot_access_denied_or_missing", {
      sourceType: "snapshot",
    });
    return null;
  }

  return data;
}

export async function verifyAccessibleSession(sessionId: string, companyId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("diagnosis_sessions")
    .select("id, company_id")
    .eq("id", sessionId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !data) {
    logAiRouteEvent("session_access_denied_or_missing", {
      sourceType: "live_result",
    });
    return null;
  }

  return data;
}
