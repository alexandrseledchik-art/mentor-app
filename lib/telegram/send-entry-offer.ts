import "server-only";

import { sendTelegramMessage } from "@/lib/telegram/telegram-bot";

export const TELEGRAM_ENTRY_OFFER_TEXT = `Покажу, где в твоём бизнесе теряются деньги
и что с этим делать.

Без воды и “успешного успеха”.

Напиши, что сейчас не работает 👇`;

export async function sendEntryOffer(chatId: number) {
  await sendTelegramMessage({
    chatId,
    text: TELEGRAM_ENTRY_OFFER_TEXT,
  });
}
