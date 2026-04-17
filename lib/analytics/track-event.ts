import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Json } from "@/types/db";

import type { AnalyticsEvent, AnalyticsPayload } from "./event-types";

export async function trackEvent<TEvent extends AnalyticsEvent>(params: {
  event: TEvent;
  payload: AnalyticsPayload<TEvent>;
  userId?: string | null;
  telegramUserId?: number | null;
  companyId?: string | null;
  diagnosisSessionId?: string | null;
  entrySessionTelegramUserId?: number | null;
}) {
  const supabase = getSupabaseAdminClient();
  const eventRecord = {
    event_name: params.event,
    user_id: params.userId ?? null,
    telegram_user_id: params.telegramUserId ?? null,
    company_id: params.companyId ?? null,
    diagnosis_session_id: params.diagnosisSessionId ?? null,
    entry_session_telegram_user_id: params.entrySessionTelegramUserId ?? null,
    payload: params.payload as Json,
  };

  const { error } = await supabase.from("analytics_events").insert(eventRecord);

  if (error) {
    console.error("ANALYTICS TRACK FAILED", {
      event: params.event,
      message: error.message,
    });
  } else {
    console.info("ANALYTICS EVENT", {
      event: params.event,
      companyId: params.companyId ?? null,
      diagnosisSessionId: params.diagnosisSessionId ?? null,
    });
  }
}
