import "server-only";

import {
  getEntrySessionByTelegramUserId,
  type InternalEntrySessionState,
  upsertEntrySession,
} from "@/lib/entry/session-state";

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

export async function markEntryOfferShown(telegramUserId: number) {
  const existingSession = await getEntrySessionByTelegramUserId(telegramUserId);

  if (existingSession) {
    return existingSession;
  }

  const now = new Date().toISOString();

  return upsertEntrySession({
    telegramUserId,
    stage: "initial",
    initialMessage: "__entry_offer__",
    clarifyingAnswers: [],
    turnCount: 1,
    createdAt: now,
    updatedAt: now,
    lastQuestionKey: null,
    lastQuestionText: null,
  } as InternalEntrySessionState);
}
