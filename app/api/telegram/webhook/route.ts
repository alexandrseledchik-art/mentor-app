import { NextResponse } from "next/server";

import { handleTelegramEntry } from "@/lib/entry/handle-entry";
import {
  sendTelegramChatAction,
  sendTelegramEntryReply,
  sendTelegramMessage,
} from "@/lib/telegram/telegram-bot";
import { markEntryOfferShown, shouldSendEntryOffer } from "@/lib/telegram/entry-session";
import { sendEntryOffer } from "@/lib/telegram/send-entry-offer";
import {
  getTelegramAudioAttachment,
  transcribeTelegramAudio,
} from "@/lib/telegram/voice";
import {
  analyzeTelegramImage,
  getTelegramImageAttachment,
} from "@/lib/telegram/image";

type TelegramWebhookUpdate = {
  message?: {
    text?: string;
    voice?: {
      file_id?: string;
      mime_type?: string;
      duration?: number;
      file_size?: number;
    };
    audio?: {
      file_id?: string;
      mime_type?: string;
      duration?: number;
      file_size?: number;
      file_name?: string;
    };
    photo?: Array<{
      file_id?: string;
      file_size?: number;
      width?: number;
      height?: number;
    }>;
    document?: {
      file_id?: string;
      mime_type?: string;
      file_name?: string;
      file_size?: number;
    };
    caption?: string;
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
  let chatId: number | undefined;
  let telegramUserId: number | undefined;

  try {
    if (!isWebhookAuthorized(request)) {
      console.error("TELEGRAM WEBHOOK UNAUTHORIZED");
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as TelegramWebhookUpdate | null;
    const message = body?.message;
    const messageFrom = message?.from;
    let text = message?.text?.trim() ?? message?.caption?.trim();
    chatId = message?.chat?.id;
    telegramUserId = messageFrom?.id;

    if (!chatId || !telegramUserId) {
      return NextResponse.json({ ok: true, processed: false });
    }

    if (!text && message) {
      const audioAttachment = getTelegramAudioAttachment(message);
      const imageAttachment = getTelegramImageAttachment(message);

      if (audioAttachment) {
        await sendTelegramChatAction({
          chatId,
          action: "typing",
        });

        text = (await transcribeTelegramAudio(audioAttachment)) ?? undefined;

        if (!text) {
          await sendTelegramMessage({
            chatId,
            text:
              "Не смог распознать голосовое. Попробуйте отправить ещё раз или напишите коротко текстом, что сейчас не работает.",
          });

          return NextResponse.json({
            ok: true,
            processed: true,
            stage: "voice_transcription_failed",
          });
        }
      } else if (imageAttachment) {
        await sendTelegramChatAction({
          chatId,
          action: "typing",
        });

        try {
          const imageContext = await analyzeTelegramImage({
            attachment: imageAttachment,
            caption: message.caption ?? null,
          });

          text = [
            message.caption?.trim() || null,
            "Пользователь прислал изображение. Видимый контекст:",
            imageContext,
          ]
            .filter(Boolean)
            .join("\n\n");
        } catch (error) {
          console.error("TELEGRAM IMAGE ANALYSIS FAILED", {
            message: error instanceof Error ? error.message : "unknown_error",
          });

          await sendTelegramMessage({
            chatId,
            text:
              "Не удалось обработать изображение. Попробуйте отправить ещё раз, добавьте короткое описание текстом или дождитесь, пока мы починим обработку модели.",
          });

          return NextResponse.json({
            ok: true,
            processed: true,
            stage: "image_analysis_failed",
          });
        }
      }
    }

    if (!text) {
      return NextResponse.json({ ok: true, processed: false });
    }

    if (message?.text && await shouldSendEntryOffer({ telegramUserId, text })) {
      const sent = await sendEntryOffer(chatId);

      if (sent) {
        try {
          await markEntryOfferShown(telegramUserId);
        } catch (error) {
          console.error("TELEGRAM ENTRY OFFER SESSION SAVE FAILED", {
            telegramUserId,
            message: error instanceof Error ? error.message : "unknown_error",
          });
        }
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

    await sendTelegramChatAction({
      chatId,
      action: "typing",
    });

    const result = await handleTelegramEntry({
      telegramUserId,
      telegramUsername: messageFrom?.username ?? null,
      firstName: messageFrom?.first_name ?? null,
      lastName: messageFrom?.last_name ?? null,
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
