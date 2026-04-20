import "server-only";

import { getOpenAiModel, getOpenAiNumberEnv } from "@/lib/openai/model-config";

type TelegramImageMessage = {
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
};

export type TelegramImageAttachment = {
  kind: "photo" | "document_image";
  fileId: string;
  mimeType: string;
  fileName: string;
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

function getLargestPhoto(
  photos: NonNullable<TelegramImageMessage["photo"]>,
) {
  return [...photos]
    .filter((item): item is NonNullable<typeof item> & { file_id: string } => typeof item?.file_id === "string")
    .sort((a, b) => (b.file_size ?? 0) - (a.file_size ?? 0))[0] ?? null;
}

export function getTelegramImageAttachment(
  message: TelegramImageMessage,
): TelegramImageAttachment | null {
  const largestPhoto = message.photo ? getLargestPhoto(message.photo) : null;

  if (largestPhoto) {
    return {
      kind: "photo",
      fileId: largestPhoto.file_id,
      mimeType: "image/jpeg",
      fileName: "telegram-photo.jpg",
    };
  }

  if (message.document?.file_id && message.document.mime_type?.startsWith("image/")) {
    return {
      kind: "document_image",
      fileId: message.document.file_id,
      mimeType: message.document.mime_type,
      fileName: message.document.file_name ?? "telegram-image",
    };
  }

  return null;
}

async function getTelegramFilePath(params: {
  botToken: string;
  fileId: string;
}) {
  const response = await fetch(
    `https://api.telegram.org/bot${params.botToken}/getFile?file_id=${encodeURIComponent(params.fileId)}`,
  );

  if (!response.ok) {
    throw new Error(`Telegram getFile failed with status ${response.status}`);
  }

  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; result?: { file_path?: string } }
    | null;

  if (!payload?.ok || !payload.result?.file_path) {
    throw new Error("Telegram getFile returned empty file path");
  }

  return payload.result.file_path;
}

async function downloadTelegramFile(params: {
  botToken: string;
  filePath: string;
}) {
  const response = await fetch(
    `https://api.telegram.org/file/bot${params.botToken}/${params.filePath}`,
  );

  if (!response.ok) {
    throw new Error(`Telegram file download failed with status ${response.status}`);
  }

  return response.arrayBuffer();
}

function toDataUrl(bytes: ArrayBuffer, mimeType: string) {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
}

function getStructuredOutput(response: Record<string, unknown>) {
  const outputText = response.output_text;

  if (typeof outputText === "string" && outputText.trim().length > 0) {
    return outputText.trim();
  }

  return null;
}

export async function analyzeTelegramImage(params: {
  attachment: TelegramImageAttachment;
  caption?: string | null;
}) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!botToken || !apiKey) {
    throw new Error("Image analysis is unavailable because required credentials are missing.");
  }

  const filePath = await getTelegramFilePath({
    botToken,
    fileId: params.attachment.fileId,
  });
  const imageBytes = await downloadTelegramFile({
    botToken,
    filePath,
  });
  const imageUrl = toDataUrl(imageBytes, params.attachment.mimeType);
  const model = getOpenAiModel();
  const temperature = getOpenAiNumberEnv("OPENAI_TEMPERATURE", 0.1);
  const maxOutputTokens = getOpenAiNumberEnv("OPENAI_MAX_TOKENS", 700);

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature,
      max_output_tokens: maxOutputTokens,
      input: [
        {
          role: "system",
          content:
            "Ты извлекаешь только полезный для бизнес-разбора визуальный контекст. Отвечай только на русском. Коротко перечисли 3-6 фактов, которые реально видны на изображении: цифры, таблицы, графики, тексты, скриншоты интерфейса, документы, схемы. Не интерпретируй лишнего и не делай диагноза.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: params.caption?.trim()
                ? `Подпись пользователя: ${params.caption.trim()}`
                : "Пользователь прислал изображение без подписи.",
            },
            {
              type: "input_image",
              image_url: imageUrl,
            },
          ],
        },
      ],
      metadata: {
        feature: "telegram_image_analysis",
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI image analysis failed with status ${response.status}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const text = getStructuredOutput(payload);

  if (!text) {
    throw new Error("OpenAI image analysis returned empty output.");
  }

  return text;
}
