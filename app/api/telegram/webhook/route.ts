import { NextResponse } from "next/server";

import { handleTelegramEntry } from "@/lib/entry/handle-entry";
import { sendTelegramEntryReply } from "@/lib/telegram/telegram-bot";
import { shouldSendEntryOffer } from "@/lib/telegram/entry-session";
import { sendEntryOffer } from "@/lib/telegram/send-entry-offer";

type TelegramWebhookUpdate = {
  message?: {
    text?: string;
    chat?: { id?: number };
    from?: {
      id?: number;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
  };
};

function isWebhookAuthorized(request: Request) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!expectedSecret) {
    return true;
  }

  return request.headers.get("x-telegram-bot-api-secret-token") === expectedSecret;
}

export async function POST(request: Request) {
  if (!isWebhookAuthorized(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as TelegramWebhookUpdate | null;
  const message = body?.message;
  const text = message?.text?.trim();
  const chatId = message?.chat?.id;
  const telegramUserId = message?.from?.id;

  if (!text || !chatId || !telegramUserId) {
    return NextResponse.json({ ok: true, processed: false });
  }

  if (await shouldSendEntryOffer({ telegramUserId, text })) {
    await sendEntryOffer(chatId);

    return NextResponse.json({
      ok: true,
      processed: true,
      stage: "offer_sent",
    });
  }

  const result = await handleTelegramEntry({
    telegramUserId,
    text,
  });

  await sendTelegramEntryReply({
    chatId,
    reply: result.reply,
  });

  return NextResponse.json({
    ok: true,
    processed: true,
    stage: result.reply.stage,
  });
}
