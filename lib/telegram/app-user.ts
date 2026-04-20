import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { AppUserIdentity } from "@/lib/workspace/types";
import type { Database } from "@/types/db";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

function mapUser(row: UserRow): AppUserIdentity {
  return {
    id: row.id,
    telegramUserId: row.telegram_user_id,
    telegramUsername: row.telegram_username,
    firstName: row.first_name,
    lastName: row.last_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getOrCreateTelegramAppUser(params: {
  telegramUserId: number;
  telegramUsername?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): Promise<AppUserIdentity> {
  const supabase = getSupabaseAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_user_id", params.telegramUserId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to load Telegram user: ${existingError.message}`);
  }

  if (existing) {
    const { data: updated, error: updateError } = await supabase
      .from("users")
      .update({
        telegram_username: params.telegramUsername ?? existing.telegram_username,
        first_name: params.firstName?.trim() || existing.first_name,
        last_name: params.lastName ?? existing.last_name,
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (updateError || !updated) {
      throw new Error(`Failed to update Telegram user: ${updateError?.message ?? "unknown_error"}`);
    }

    return mapUser(updated);
  }

  const { data: created, error: createError } = await supabase
    .from("users")
    .insert({
      telegram_user_id: params.telegramUserId,
      telegram_username: params.telegramUsername ?? null,
      first_name: params.firstName?.trim() || "Telegram User",
      last_name: params.lastName ?? null,
    })
    .select("*")
    .single();

  if (createError || !created) {
    throw new Error(`Failed to create Telegram user: ${createError?.message ?? "unknown_error"}`);
  }

  return mapUser(created);
}
