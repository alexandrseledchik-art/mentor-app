import "server-only";

type TelegramAudioMessage = {
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
};

export type TelegramAudioAttachment = {
  kind: "voice" | "audio";
  fileId: string;
  mimeType: string;
  duration: number | null;
  fileSize: number | null;
  fileName: string;
};

const TELEGRAM_FILE_BASE_URL = "https://api.telegram.org/file";
const OPENAI_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions";

export function getTelegramAudioAttachment(
  message: TelegramAudioMessage,
): TelegramAudioAttachment | null {
  if (message.voice?.file_id) {
    return {
      kind: "voice",
      fileId: message.voice.file_id,
      mimeType: message.voice.mime_type ?? "audio/ogg",
      duration: message.voice.duration ?? null,
      fileSize: message.voice.file_size ?? null,
      fileName: "telegram-voice.ogg",
    };
  }

  if (message.audio?.file_id) {
    return {
      kind: "audio",
      fileId: message.audio.file_id,
      mimeType: message.audio.mime_type ?? "audio/mpeg",
      duration: message.audio.duration ?? null,
      fileSize: message.audio.file_size ?? null,
      fileName: message.audio.file_name ?? "telegram-audio.mp3",
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
    console.error("TELEGRAM VOICE GET_FILE_FAILED", {
      status: response.status,
    });
    return null;
  }

  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; result?: { file_path?: string } }
    | null;

  if (!payload?.ok || !payload.result?.file_path) {
    console.error("TELEGRAM VOICE GET_FILE_EMPTY");
    return null;
  }

  return payload.result.file_path;
}

async function downloadTelegramFile(params: {
  botToken: string;
  filePath: string;
}) {
  const response = await fetch(
    `${TELEGRAM_FILE_BASE_URL}/bot${params.botToken}/${params.filePath}`,
  );

  if (!response.ok) {
    console.error("TELEGRAM VOICE DOWNLOAD_FAILED", {
      status: response.status,
    });
    return null;
  }

  return response.arrayBuffer();
}

export async function transcribeTelegramAudio(
  attachment: TelegramAudioAttachment,
): Promise<string | null> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const openAiApiKey = process.env.OPENAI_API_KEY;
  const transcriptionModel =
    process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() || "gpt-4o-mini-transcribe";

  if (!botToken || !openAiApiKey) {
    console.error("TELEGRAM VOICE TRANSCRIPTION_SKIPPED", {
      reason: !botToken ? "missing_bot_token" : "missing_openai_api_key",
    });
    return null;
  }

  const filePath = await getTelegramFilePath({
    botToken,
    fileId: attachment.fileId,
  });

  if (!filePath) {
    return null;
  }

  const audioBytes = await downloadTelegramFile({
    botToken,
    filePath,
  });

  if (!audioBytes) {
    return null;
  }

  const formData = new FormData();
  formData.append("model", transcriptionModel);
  formData.append("response_format", "json");
  formData.append(
    "file",
    new Blob([audioBytes], { type: attachment.mimeType }),
    attachment.fileName,
  );

  const response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error("TELEGRAM VOICE TRANSCRIPTION_FAILED", {
      status: response.status,
      body: errorText.slice(0, 300),
    });
    return null;
  }

  const payload = (await response.json().catch(() => null)) as
    | { text?: string }
    | null;
  const text = payload?.text?.trim();

  return text && text.length > 0 ? text : null;
}
