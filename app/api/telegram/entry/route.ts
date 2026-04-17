import { NextResponse } from "next/server";

import { handleTelegramEntry } from "@/lib/entry/handle-entry";
import type { TelegramEntryResponse } from "@/types/api";
import {
  entryHypothesisSchema,
  entryIntentSchema,
  entryRoutingDecisionSchema,
  entrySessionStateSchema,
  telegramEntryReplySchema,
  telegramEntryRequestSchema,
} from "@/validators/diagnosis";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = telegramEntryRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Некорректный Telegram entry payload.",
      },
      { status: 400 },
    );
  }

  const result = await handleTelegramEntry({
    telegramUserId: parsed.data.telegramUserId,
    text: parsed.data.text,
  });

  const payload: TelegramEntryResponse = {
    reply: telegramEntryReplySchema.parse(result.reply),
    session: entrySessionStateSchema.parse(result.session),
    intent: result.intent ? entryIntentSchema.parse(result.intent) : null,
    hypothesis: result.hypothesis ? entryHypothesisSchema.parse(result.hypothesis) : null,
    decision: entryRoutingDecisionSchema.parse(result.decision),
  };

  return NextResponse.json(payload);
}
