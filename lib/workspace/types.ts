export interface Workspace {
  id: string;
  userId: string;
  activeCompanyId: string | null;
  activeDiagnosisSessionId: string | null;
  lastCompletedDiagnosisSessionId: string | null;
  lastVisitedRoute: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceRowLike {
  id: string;
  user_id: string;
  active_company_id: string | null;
  active_diagnosis_session_id: string | null;
  last_completed_diagnosis_session_id: string | null;
  last_visited_route: string | null;
  created_at: string;
  updated_at: string;
}

export type EntryRoute = "onboarding" | "resume_diagnosis" | "dashboard";

export interface EntryResolution {
  route: EntryRoute;
  workspace: Workspace;
}

export interface AppUserIdentity {
  id: string;
  telegramUserId: number;
  telegramUsername: string | null;
  firstName: string;
  lastName: string | null;
  createdAt: string;
  updatedAt: string;
}
