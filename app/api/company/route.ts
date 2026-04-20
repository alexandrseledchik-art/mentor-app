import { NextResponse } from "next/server";

import { getCurrentUserId, SESSION_USER_COOKIE } from "@/lib/session";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/workspace/get-or-create-workspace";
import { setActiveCompany } from "@/lib/workspace/set-active-company";
import { companyPayloadSchema } from "@/validators/company";

function isMissingCompanyIsActiveColumn(error: { message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return message.includes("is_active") && message.includes("companies");
}

function getFriendlyCompanyApiError(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes("Missing Supabase server environment variables")) {
      return "Сервер не настроен для работы с Supabase. Проверьте server env variables.";
    }

    return error.message;
  }

  return "Не удалось завершить onboarding из-за серверной ошибки.";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = companyPayloadSchema.safeParse(body);

    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message ?? "Некорректные данные компании.";

      return NextResponse.json({ error: message }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { name, industry, team_size, monthly_revenue_range, goal } = parsed.data;
    const currentUserId = await getCurrentUserId();
    let createdAuthUserId: string | null = null;
    let appUser: { id: string } | null = null;

    if (currentUserId) {
      const { data: existingUser, error: existingUserError } = await supabase
        .from("users")
        .select("id")
        .eq("id", currentUserId)
        .maybeSingle();

      if (existingUserError) {
        console.error("CURRENT APP USER ERROR FULL:", JSON.stringify(existingUserError, null, 2));
      }

      appUser = existingUser;
    }

    if (!appUser) {
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

      createdAuthUserId = authUser.id;

      const { data: createdAppUser, error: appUserError } = await supabase
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

      if (appUserError || !createdAppUser) {
        console.error("APP USER ERROR FULL:", JSON.stringify(appUserError, null, 2));
        await supabase.auth.admin.deleteUser(authUser.id).catch((cleanupError) => {
          console.error("APP USER CLEANUP ERROR:", cleanupError);
        });

        return NextResponse.json(
          {
            error: appUserError?.message || "Ошибка создания профиля пользователя",
            details: appUserError,
          },
          { status: 500 },
        );
      }

      appUser = createdAppUser;
    }

    let companyInsert = await supabase
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

    if (companyInsert.error && isMissingCompanyIsActiveColumn(companyInsert.error)) {
      companyInsert = await supabase
        .from("companies")
        .insert({
          user_id: appUser.id,
          name,
          industry,
          team_size,
          revenue_range: monthly_revenue_range,
          primary_goal: goal,
          onboarding_completed: true,
        })
        .select("id, name, industry, team_size, revenue_range, primary_goal")
        .single();
    }

    const { data: company, error: companyError } = companyInsert;

    if (companyError || !company) {
      console.error("COMPANY ERROR FULL:", JSON.stringify(companyError, null, 2));
      if (createdAuthUserId) {
        try {
          const { error: cleanupError } = await supabase
            .from("users")
            .delete()
            .eq("id", appUser.id);

          if (cleanupError) {
            console.error("COMPANY APP USER CLEANUP ERROR:", cleanupError);
          }
        } catch (cleanupError) {
          console.error("COMPANY APP USER CLEANUP ERROR:", cleanupError);
        }

        await supabase.auth.admin.deleteUser(createdAuthUserId).catch((cleanupError) => {
          console.error("COMPANY AUTH USER CLEANUP ERROR:", cleanupError);
        });
      }

      return NextResponse.json(
        {
          error: companyError?.message || "Ошибка создания компании",
          details: companyError,
        },
        { status: 500 },
      );
    }

    console.log("ONBOARDING USER READY:", appUser.id);
    console.log("ONBOARDING COMPANY CREATED:", {
      companyId: company.id,
      companyUserId: appUser.id,
    });

    try {
      await getOrCreateWorkspace(appUser.id);
      await setActiveCompany({
        userId: appUser.id,
        companyId: company.id,
        syncCompanyFlag: true,
      });
    } catch (workspaceError) {
      console.error("WORKSPACE/ACTIVE COMPANY ERROR:", workspaceError);
      return NextResponse.json(
        {
          error: "Компания создана, но не удалось завершить настройку workspace. Попробуйте еще раз.",
        },
        { status: 500 },
      );
    }

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
  } catch (error) {
    console.error("COMPANY ROUTE UNHANDLED ERROR:", error);
    return NextResponse.json(
      {
        error: getFriendlyCompanyApiError(error),
      },
      { status: 500 },
    );
  }
}
