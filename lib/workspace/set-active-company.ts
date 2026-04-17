import { getSupabaseAdminClient } from "@/lib/supabase/server";

function isMissingCompanyIsActiveColumn(error: { message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return message.includes("is_active") && message.includes("companies");
}

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
    if (isMissingCompanyIsActiveColumn(deactivateError)) {
      console.warn("COMPANIES.IS_ACTIVE SYNC SKIPPED", {
        phase: "deactivate",
      });
      return;
    }

    throw deactivateError;
  }

  const { error: activateError } = await supabase
    .from("companies")
    .update({ is_active: true })
    .eq("id", params.companyId);

  if (activateError) {
    if (isMissingCompanyIsActiveColumn(activateError)) {
      console.warn("COMPANIES.IS_ACTIVE SYNC SKIPPED", {
        phase: "activate",
      });
      return;
    }

    throw activateError;
  }
}
