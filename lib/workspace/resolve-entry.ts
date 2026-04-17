import { getCurrentAppUser } from "./get-current-app-user";
import { getOrCreateWorkspace } from "./get-or-create-workspace";

import type { EntryResolution, EntryRoute } from "./types";

function resolveEntryRoute(params: {
  activeCompanyId: string | null;
  activeDiagnosisSessionId: string | null;
}): EntryRoute {
  if (!params.activeCompanyId) {
    return "onboarding";
  }

  if (params.activeDiagnosisSessionId) {
    return "resume_diagnosis";
  }

  return "dashboard";
}

export async function resolveEntry(): Promise<EntryResolution | null> {
  const user = await getCurrentAppUser();

  if (!user) {
    return null;
  }

  const workspace = await getOrCreateWorkspace(user.id);

  return {
    route: resolveEntryRoute({
      activeCompanyId: workspace.activeCompanyId,
      activeDiagnosisSessionId: workspace.activeDiagnosisSessionId,
    }),
    workspace,
  };
}
