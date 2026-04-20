import "server-only";

import { getPublicAppUrl } from "@/lib/app-url";

export function buildCaseDeepLink(params: {
  caseId: string;
  token: string;
}) {
  const url = new URL(`/cases/${params.caseId}`, getPublicAppUrl());

  url.searchParams.set("source", "telegram_diagnostic");
  url.searchParams.set("token", params.token);

  return url.toString();
}
