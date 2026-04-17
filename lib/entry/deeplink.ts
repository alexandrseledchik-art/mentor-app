type DiagnosisDeepLinkParams = {
  entryMode?: string;
  entryIntent?: string;
  suggestedTool?: string;
};

function getBaseUrl() {
  return (
    process.env.TELEGRAM_MINI_APP_URL ??
    process.env.NEXT_PUBLIC_MINI_APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    ""
  );
}

export function buildDiagnosisDeepLink(params: DiagnosisDeepLinkParams = {}) {
  const baseUrl = getBaseUrl();
  const url = new URL("/diagnosis", baseUrl || "https://example.local");

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

  return baseUrl ? url.toString() : `${url.pathname}${url.search}`;
}

export function buildToolDeepLink(toolSlug: string) {
  const baseUrl = getBaseUrl();
  const url = new URL(`/tools/${toolSlug}`, baseUrl || "https://example.local");

  url.searchParams.set("source", "telegram_entry");

  return baseUrl ? url.toString() : `${url.pathname}${url.search}`;
}
