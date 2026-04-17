import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { ToolDemandSignal } from "@/types/domain";

export async function captureToolDemandSignal(signal: ToolDemandSignal) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("tool_demand_signals").insert({
    tool_query: signal.toolQuery,
    normalized_tool: signal.normalizedTool ?? null,
    entry_mode: signal.entryMode,
    detected_intent: signal.detectedIntent ?? null,
    confidence: signal.confidence,
    telegram_user_id: signal.telegramUserId,
    created_at: signal.createdAt,
  });

  if (error) {
    console.error("ENTRY TOOL DEMAND SIGNAL INSERT FAILED", {
      entryMode: signal.entryMode,
      confidence: signal.confidence,
    });
  }
}

export async function notifyAdminAboutToolDemand(signal: ToolDemandSignal) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  console.error("ENTRY TOOL DEMAND SIGNAL", {
    toolQuery: signal.toolQuery,
    normalizedTool: signal.normalizedTool,
    entryMode: signal.entryMode,
    confidence: signal.confidence,
    createdAt: signal.createdAt,
  });

  if (!botToken || !adminChatId) {
    return;
  }

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: adminChatId,
        text: [
          "Новый сигнал по отсутствующему инструменту.",
          `toolQuery: ${signal.toolQuery}`,
          `normalizedTool: ${signal.normalizedTool ?? "n/a"}`,
          `entryMode: ${signal.entryMode}`,
          `detectedIntent: ${signal.detectedIntent ?? "n/a"}`,
          `confidence: ${signal.confidence}`,
          `timestamp: ${signal.createdAt}`,
        ].join("\n"),
      }),
    });
  } catch (error) {
    console.error("ENTRY TOOL DEMAND ADMIN NOTIFY FAILED", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
  }
}
