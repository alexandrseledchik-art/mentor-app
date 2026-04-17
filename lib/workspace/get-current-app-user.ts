import { getCurrentUserId } from "@/lib/session";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/types/db";

import type { AppUserIdentity } from "./types";

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

export async function getCurrentAppUser(): Promise<AppUserIdentity | null> {
  const currentUserId = await getCurrentUserId();

  if (!currentUserId) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", currentUserId)
    .maybeSingle();

  if (error || !user) {
    return null;
  }

  return mapUser(user);
}
