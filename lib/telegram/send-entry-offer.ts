import "server-only";

import { sendTelegramMessage } from "@/lib/telegram/telegram-bot";

export const TELEGRAM_ENTRY_OFFER_TEXT = `Здесь можно быстро разобрать, где бизнес буксует и что делать первым.

Достаточно сайта или пары фраз о ситуации.

Напишите запрос как есть. Можно текстом, голосом, ссылкой или картинкой 👇`;

export async function sendEntryOffer(chatId: number) {
  return sendTelegramMessage({
    chatId,
    text: TELEGRAM_ENTRY_OFFER_TEXT,
  });
}
