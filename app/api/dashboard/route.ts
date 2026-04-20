import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getDashboardWorkspaceContext } from "@/lib/workspace/get-dashboard-context";
import type { DashboardResponse } from "@/types/api";
import type { Database } from "@/types/db";
import type { Tool, User } from "@/types/domain";

type ToolRow = Database["public"]["Tables"]["tools"]["Row"];

function mapUser(params: {
  id: string;
  telegramUserId: number;
  telegramUsername: string | null;
  firstName: string;
  lastName: string | null;
  createdAt: string;
  updatedAt: string;
}): User {
  return {
    id: params.id,
    telegramUserId: params.telegramUserId,
    telegramUsername: params.telegramUsername,
    firstName: params.firstName,
    lastName: params.lastName,
    languageCode: null,
    photoUrl: null,
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
  };
}

function mapTool(row: ToolRow): Tool {
  return {
    id: row.id,
    categoryId: row.category_id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    problem: row.problem,
    format: row.format as Tool["format"],
    stage: (row.stage as Tool["stage"]) ?? null,
    estimatedMinutes: row.estimated_minutes,
    isFeatured: row.is_featured,
    content:
      row.content && typeof row.content === "object" && !Array.isArray(row.content)
        ? (row.content as Record<string, unknown>)
        : {},
    createdAt: row.created_at,
  };
}

export async function GET() {
  const supabase = getSupabaseAdminClient();
  const dashboardContext = await getDashboardWorkspaceContext();

  if (!dashboardContext) {
    return NextResponse.json({ error: "Пользователь не найден." }, { status: 401 });
  }

  if (!dashboardContext.activeCompany) {
    return NextResponse.json({ error: "Компания не найдена." }, { status: 404 });
  }

  const { data: featuredTools } = await supabase
    .from("tools")
    .select("*")
    .eq("is_featured", true)
    .order("created_at", { ascending: false })
    .limit(3);

  const payload: DashboardResponse = {
    user: mapUser({
      id: dashboardContext.user.id,
      telegramUserId: dashboardContext.user.telegramUserId,
      telegramUsername: dashboardContext.user.telegramUsername,
      firstName: dashboardContext.user.firstName,
      lastName: dashboardContext.user.lastName,
      createdAt: dashboardContext.user.createdAt,
      updatedAt: dashboardContext.user.updatedAt,
    }),
    company: dashboardContext.activeCompany,
    activeDiagnosis: dashboardContext.activeDiagnosis,
    lastCompletedDiagnosis: dashboardContext.lastCompletedDiagnosis,
    latestResultSnapshot: dashboardContext.latestResultSnapshot,
    resultHistoryCount: dashboardContext.resultHistoryCount,
    latestCase: dashboardContext.latestCase,
    caseHistoryCount: dashboardContext.caseHistoryCount,
    companySnapshot: dashboardContext.companySnapshot,
    latestDiagnosis: dashboardContext.lastCompletedDiagnosis,
    featuredTools: (featuredTools ?? []).map(mapTool),
  };

  return NextResponse.json(payload);
}
