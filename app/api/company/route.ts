import { NextResponse } from "next/server";

import { SESSION_USER_COOKIE } from "@/lib/session";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace/get-or-create-workspace";
import { setActiveCompany } from "@/lib/workspace/set-active-company";
import { companyPayloadSchema } from "@/validators/company";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = companyPayloadSchema.safeParse(body);

  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Некорректные данные компании.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { name, industry, team_size, monthly_revenue_range, goal } = parsed.data;
  const timestamp = Date.now();
  const email = `onboarding_${timestamp}@example.local`;
  const password = `TempPass123!${timestamp}`;
  const telegramUserId = timestamp * 1000 + Math.floor(Math.random() * 1000);

  const { data: authData, error: userError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  const authUser = authData.user;

  if (userError || !authUser) {
    console.error("USER ERROR FULL:", JSON.stringify(userError, null, 2));

    return NextResponse.json(
      {
        error: userError?.message || "Ошибка создания пользователя",
        details: userError,
      },
      { status: 500 },
    );
  }

  const { data: appUser, error: appUserError } = await supabase
    .from("users")
    .insert({
      id: authUser.id,
      telegram_user_id: telegramUserId,
      telegram_username: null,
      first_name: "User",
      last_name: null,
    })
    .select("id")
    .single();

  if (appUserError || !appUser) {
    console.error("APP USER ERROR FULL:", JSON.stringify(appUserError, null, 2));

    return NextResponse.json(
      {
        error: appUserError?.message || "Ошибка создания профиля пользователя",
        details: appUserError,
      },
      { status: 500 },
    );
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({
      user_id: appUser.id,
      name,
      industry,
      team_size,
      revenue_range: monthly_revenue_range,
      primary_goal: goal,
      onboarding_completed: true,
      is_active: true,
    })
    .select("id, name, industry, team_size, revenue_range, primary_goal")
    .single();

  if (companyError || !company) {
    console.error("COMPANY ERROR FULL:", JSON.stringify(companyError, null, 2));

    return NextResponse.json(
      {
        error: companyError?.message || "Ошибка создания компании",
        details: companyError,
      },
      { status: 500 },
    );
  }

  console.log("ONBOARDING USER CREATED:", authUser.id);
  console.log("ONBOARDING COMPANY CREATED:", {
    companyId: company.id,
    companyUserId: appUser.id,
  });

  await getOrCreateWorkspace(appUser.id);
  await setActiveCompany({
    userId: appUser.id,
    companyId: company.id,
    syncCompanyFlag: true,
  });

  const response = NextResponse.json({
    company,
  });

  response.cookies.set(SESSION_USER_COOKIE, appUser.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
