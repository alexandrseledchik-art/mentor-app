import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function setActiveCompany(params: {
  userId: string;
  companyId: string;
  syncCompanyFlag?: boolean;
}) {
  const supabase = getSupabaseAdminClient();

  const { error: workspaceError } = await supabase
    .from("workspaces")
    .update({
      active_company_id: params.companyId,
      last_visited_route: "/dashboard",
    })
    .eq("user_id", params.userId);

  if (workspaceError) {
    throw workspaceError;
  }

  if (!params.syncCompanyFlag) {
    return;
  }

  const { error: deactivateError } = await supabase
    .from("companies")
    .update({ is_active: false })
    .eq("user_id", params.userId);

  if (deactivateError) {
    throw deactivateError;
  }

  const { error: activateError } = await supabase
    .from("companies")
    .update({ is_active: true })
    .eq("id", params.companyId);

  if (activateError) {
    throw activateError;
  }
}
