import { getPublicAppUrl } from "@/lib/app-url";

type DiagnosisDeepLinkParams = {
  entryMode?: string;
  entryIntent?: string;
  suggestedTool?: string;
};

export function buildDiagnosisDeepLink(params: DiagnosisDeepLinkParams = {}) {
  const url = new URL("/diagnosis", getPublicAppUrl());

  url.searchParams.set("source", "telegram_entry");

  if (params.entryMode) {
    url.searchParams.set("entry_mode", params.entryMode);
  }

  if (params.entryIntent) {
    url.searchParams.set("entry_intent", params.entryIntent);
  }

  if (params.suggestedTool) {
    url.searchParams.set("suggested_tool", params.suggestedTool);
  }

  return url.toString();
}

export function buildToolDeepLink(toolSlug: string) {
  const url = new URL(`/tools/${toolSlug}`, getPublicAppUrl());

  url.searchParams.set("source", "telegram_entry");

  return url.toString();
}
