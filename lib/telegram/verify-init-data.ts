import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyTelegramInitData(initData: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken || !initData.trim()) {
    return false;
  }

  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");

  if (!receivedHash) {
    return false;
  }

  params.delete("hash");

  const dataCheckString = Array.from(params.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculatedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const received = Buffer.from(receivedHash, "hex");
  const calculated = Buffer.from(calculatedHash, "hex");

  return received.length === calculated.length && timingSafeEqual(received, calculated);
}

export function parseTelegramUserFromInitData(initData: string): {
  id: number;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
} | null {
  const rawUser = new URLSearchParams(initData).get("user");

  if (!rawUser) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawUser) as {
      id?: unknown;
      username?: unknown;
      first_name?: unknown;
      last_name?: unknown;
    };

    if (typeof parsed.id !== "number") {
      return null;
    }

    return {
      id: parsed.id,
      username: typeof parsed.username === "string" ? parsed.username : null,
      first_name: typeof parsed.first_name === "string" ? parsed.first_name : null,
      last_name: typeof parsed.last_name === "string" ? parsed.last_name : null,
    };
  } catch {
    return null;
  }
}
