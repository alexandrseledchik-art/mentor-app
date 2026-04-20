import { NextResponse } from "next/server";

import { SESSION_USER_COOKIE } from "@/lib/session";
import { getOrCreateTelegramAppUser } from "@/lib/telegram/app-user";
import {
  parseTelegramUserFromInitData,
  verifyTelegramInitData,
} from "@/lib/telegram/verify-init-data";
import { getOrCreateWorkspace } from "@/lib/workspace/get-or-create-workspace";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    initData?: unknown;
  } | null;
  const initData = typeof body?.initData === "string" ? body.initData : "";

  if (!initData) {
    return NextResponse.json({ error: "Telegram initData is missing." }, { status: 400 });
  }

  if (!verifyTelegramInitData(initData)) {
    console.error("TELEGRAM MINI APP AUTH INVALID_INIT_DATA");
    return NextResponse.json({ error: "Telegram auth failed." }, { status: 401 });
  }

  const telegramUser = parseTelegramUserFromInitData(initData);

  if (!telegramUser) {
    return NextResponse.json({ error: "Telegram user is missing." }, { status: 400 });
  }

  const appUser = await getOrCreateTelegramAppUser({
    telegramUserId: telegramUser.id,
    telegramUsername: telegramUser.username ?? null,
    firstName: telegramUser.first_name ?? null,
    lastName: telegramUser.last_name ?? null,
  });

  await getOrCreateWorkspace(appUser.id);

  const response = NextResponse.json({
    ok: true,
    userId: appUser.id,
  });

  response.cookies.set(SESSION_USER_COOKIE, appUser.id, {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
