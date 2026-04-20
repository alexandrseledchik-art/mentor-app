import { getPublicAppUrl } from "@/lib/app-url";

type DiagnosisDeepLinkParams = {
  suggestedTool?: string;
  intakeGoal?: string | null;
  intakeSymptoms?: string[];
};

export function buildDiagnosisDeepLink(params: DiagnosisDeepLinkParams = {}) {
  const url = new URL("/diagnosis", getPublicAppUrl());

  url.searchParams.set("source", "telegram_entry");

  if (params.suggestedTool) {
    url.searchParams.set("suggested_tool", params.suggestedTool);
  }

  if (params.intakeGoal) {
    url.searchParams.set("intake_goal", params.intakeGoal);
  }

  if (params.intakeSymptoms?.length) {
    url.searchParams.set("intake_symptoms", params.intakeSymptoms.slice(0, 3).join("|"));
  }

  return url.toString();
}

export function buildToolDeepLink(toolSlug: string) {
  const url = new URL(`/tools/${toolSlug}`, getPublicAppUrl());

  url.searchParams.set("source", "telegram_entry");

  return url.toString();
}
