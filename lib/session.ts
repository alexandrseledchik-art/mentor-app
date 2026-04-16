import { cookies } from "next/headers";

export const SESSION_USER_COOKIE = "mentor_user_id";

export async function getCurrentUserId() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_USER_COOKIE)?.value ?? null;
}
