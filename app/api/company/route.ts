import { NextResponse } from "next/server";

import { SESSION_USER_COOKIE } from "@/lib/session";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
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

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({
      user_id: authUser.id,
      name,
      industry,
      team_size,
      revenue_range: monthly_revenue_range,
      primary_goal: goal,
      onboarding_completed: true,
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
    companyUserId: authUser.id,
  });

  const response = NextResponse.json({
    company,
  });

  response.cookies.set(SESSION_USER_COOKIE, authUser.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
