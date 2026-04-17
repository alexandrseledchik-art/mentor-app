import "server-only";

import type { TelegramEntryReply } from "@/types/domain";

export async function sendTelegramEntryReply(params: {
  chatId: number;
  reply: TelegramEntryReply;
}) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.error("TELEGRAM ENTRY SEND SKIPPED", {
      reason: "missing_bot_token",
    });
    return;
  }

  const body: Record<string, unknown> = {
    chat_id: params.chatId,
    text: params.reply.text,
  };

  if (params.reply.cta) {
    body.reply_markup = {
      inline_keyboard: [
        [
          {
            text: params.reply.cta.label,
            url: params.reply.cta.url,
          },
        ],
      ],
    };
  }

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error("TELEGRAM ENTRY SEND FAILED", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
  }
}
