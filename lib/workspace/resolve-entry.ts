import { getCurrentAppUser } from "./get-current-app-user";
import { getActiveDiagnosisSession } from "./get-active-diagnosis";
import { getOrCreateWorkspace } from "./get-or-create-workspace";

import type { EntryResolution, EntryRoute } from "./types";

function resolveEntryRoute(params: {
  activeCompanyId: string | null;
  hasActiveDiagnosis: boolean;
}): EntryRoute {
  if (!params.activeCompanyId) {
    return "onboarding";
  }

  if (params.hasActiveDiagnosis) {
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
  const activeDiagnosis = await getActiveDiagnosisSession(user.id);

  return {
    route: resolveEntryRoute({
      activeCompanyId: workspace.activeCompanyId,
      hasActiveDiagnosis: Boolean(activeDiagnosis),
    }),
    workspace,
  };
}
