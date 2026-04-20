import "server-only";

import { sendTelegramMessage } from "@/lib/telegram/telegram-bot";

export const TELEGRAM_ENTRY_OFFER_TEXT = `Здравствуйте!

Вы общаетесь с AI-ассистентом Александра Селедчика по разбору бизнеса и управленческой диагностике.

За 3 минуты покажу, где бизнес теряет деньги, время и управляемость — и что делать первым.

Достаточно сайта или пары фраз о ситуации.

Расскажите о запросе любым удобным способом 👇`;

export async function sendEntryOffer(chatId: number) {
  return sendTelegramMessage({
    chatId,
    text: TELEGRAM_ENTRY_OFFER_TEXT,
  });
}
