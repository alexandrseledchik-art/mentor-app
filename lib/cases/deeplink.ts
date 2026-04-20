import "server-only";

function getBaseUrl() {
  return (
    process.env.TELEGRAM_MINI_APP_URL ??
    process.env.NEXT_PUBLIC_MINI_APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    ""
  );
}

export function buildCaseDeepLink(params: {
  caseId: string;
  token: string;
}) {
  const baseUrl = getBaseUrl();
  const url = new URL(`/cases/${params.caseId}`, baseUrl || "https://example.local");

  url.searchParams.set("source", "telegram_diagnostic");
  url.searchParams.set("token", params.token);

  return baseUrl ? url.toString() : `${url.pathname}${url.search}`;
}
