import "server-only";

import { getEntrySessionByTelegramUserId } from "@/lib/entry/session-state";

export async function hasActiveEntrySession(telegramUserId: number) {
  const session = await getEntrySessionByTelegramUserId(telegramUserId);
  return Boolean(session);
}

export async function shouldSendEntryOffer(params: {
  telegramUserId: number;
  text: string;
}) {
  const normalizedText = params.text.trim().toLowerCase();

  if (normalizedText === "/start" || normalizedText.startsWith("/start ")) {
    return true;
  }

  const hasSession = await hasActiveEntrySession(params.telegramUserId);
  return !hasSession;
}
