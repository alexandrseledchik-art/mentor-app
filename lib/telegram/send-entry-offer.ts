import "server-only";

import { sendTelegramMessage } from "@/lib/telegram/telegram-bot";

export const TELEGRAM_ENTRY_OFFER_TEXT = `За 3 минуты покажу, где бизнес теряет деньги, время и управляемость — и что делать первым.

Достаточно сайта или пары фраз о ситуации.
Без воды и “успешного успеха”.

Напишите, что сейчас не работает 👇`;

export async function sendEntryOffer(chatId: number) {
  return sendTelegramMessage({
    chatId,
    text: TELEGRAM_ENTRY_OFFER_TEXT,
  });
}
