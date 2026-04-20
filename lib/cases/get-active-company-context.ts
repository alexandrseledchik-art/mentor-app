import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace/get-or-create-workspace";
import type { Workspace } from "@/lib/workspace/types";

export interface CaseCompanyContext {
  company: {
    id: string;
    name: string;
    industry: string | null;
    teamSize: string | null;
    revenueRange: string | null;
    primaryGoal: string | null;
  } | null;
  workspace: Workspace;
}

export async function getActiveCompanyContextForCase(userId: string): Promise<CaseCompanyContext> {
  const supabase = getSupabaseAdminClient();
  const workspace = await getOrCreateWorkspace(userId);

  if (!workspace.activeCompanyId) {
    return {
      workspace,
      company: null,
    };
  }

  const { data: company, error } = await supabase
    .from("companies")
    .select("id, name, industry, team_size, revenue_range, primary_goal")
    .eq("id", workspace.activeCompanyId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !company) {
    return {
      workspace,
      company: null,
    };
  }

  return {
    workspace,
    company: {
      id: company.id,
      name: company.name,
      industry: company.industry,
      teamSize: company.team_size,
      revenueRange: company.revenue_range,
      primaryGoal: company.primary_goal,
    },
  };
}
