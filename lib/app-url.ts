const FALLBACK_APP_URL = "https://mentor-app-blue.vercel.app";

function normalizeOrigin(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);

    if (url.hostname === "t.me" || url.hostname.endsWith(".t.me")) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

export function getPublicAppUrl() {
  return (
    normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeOrigin(process.env.NEXT_PUBLIC_MINI_APP_URL) ??
    normalizeOrigin(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
    FALLBACK_APP_URL
  );
}
