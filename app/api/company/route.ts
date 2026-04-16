import { NextResponse } from "next/server";

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

  const { data: user, error: userError } = await supabase
    .from("users")
    .insert({
      telegram_user_id: Date.now(),
      first_name: "Demo",
      last_name: "User",
    })
    .select("id")
    .single();

  if (userError || !user) {
    console.error("USER ERROR FULL:", JSON.stringify(userError, null, 2));

    return NextResponse.json(
      {
        error: "USER ERROR",
        details: userError,
      },
      { status: 500 },
    );
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({
      user_id: user.id,
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
    console.error("COMPANY ERROR:", companyError);

    return NextResponse.json(
      {
        error: companyError?.message || "Ошибка создания компании",
        details: companyError,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    company,
  });
}
