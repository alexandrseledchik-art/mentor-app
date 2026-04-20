import "server-only";

import { getPublicAppUrl } from "@/lib/app-url";

import type { TelegramEntryReply } from "@/types/domain";

function shouldOpenAsTelegramWebApp(url: string) {
  try {
    const buttonUrl = new URL(url);
    const appUrl = new URL(getPublicAppUrl());

    return buttonUrl.protocol === "https:" && buttonUrl.origin === appUrl.origin;
  } catch {
    return false;
  }
}

function buildInlineKeyboardButton(params: {
  label: string;
  url: string;
}) {
  if (shouldOpenAsTelegramWebApp(params.url)) {
    return {
      text: params.label,
      web_app: {
        url: params.url,
      },
    };
  }

  return {
    text: params.label,
    url: params.url,
  };
}

export async function sendTelegramMessage(params: {
  chatId: number;
  text: string;
  cta?: {
    label: string;
    url: string;
  };
}) : Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.error("TELEGRAM MESSAGE SEND SKIPPED", {
      reason: "missing_bot_token",
    });
    return false;
  }

  const body: Record<string, unknown> = {
    chat_id: params.chatId,
    text: params.text,
  };

  if (params.cta) {
    body.reply_markup = {
      inline_keyboard: [
        [
          buildInlineKeyboardButton({
            label: params.cta.label,
            url: params.cta.url,
          }),
        ],
      ],
    };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("TELEGRAM MESSAGE SEND FAILED", {
        status: response.status,
        body: errorText || "empty_response",
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error("TELEGRAM MESSAGE SEND FAILED", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return false;
  }
}

export async function sendTelegramEntryReply(params: {
  chatId: number;
  reply: TelegramEntryReply;
}) {
  return sendTelegramMessage({
    chatId: params.chatId,
    text: params.reply.text,
    cta: params.reply.cta,
  });
}
