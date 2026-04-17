import { NextResponse } from "next/server";

import { handleTelegramEntry } from "@/lib/entry/handle-entry";
import { sendTelegramEntryReply } from "@/lib/telegram/telegram-bot";
import { markEntryOfferShown, shouldSendEntryOffer } from "@/lib/telegram/entry-session";
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
  try {
    if (!isWebhookAuthorized(request)) {
      console.error("TELEGRAM WEBHOOK UNAUTHORIZED");
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
      const sent = await sendEntryOffer(chatId);

      if (sent) {
        await markEntryOfferShown(telegramUserId);
      } else {
        console.error("TELEGRAM ENTRY OFFER NOT SENT", {
          telegramUserId,
          chatId,
        });
      }

      return NextResponse.json({
        ok: sent,
        processed: true,
        stage: "offer_sent",
      });
    }

    const result = await handleTelegramEntry({
      telegramUserId,
      text,
    });

    const sent = await sendTelegramEntryReply({
      chatId,
      reply: result.reply,
    });

    if (!sent) {
      console.error("TELEGRAM ENTRY REPLY NOT SENT", {
        telegramUserId,
        chatId,
        stage: result.reply.stage,
      });
    }

    return NextResponse.json({
      ok: sent,
      processed: true,
      stage: result.reply.stage,
    });
  } catch (error) {
    console.error("TELEGRAM WEBHOOK FAILED", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json({ ok: false, processed: false }, { status: 500 });
  }
}
