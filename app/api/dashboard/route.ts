import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/session";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { DashboardResponse } from "@/types/api";
import type { Database } from "@/types/db";
import type { Company, DiagnosisSession, Tool, User } from "@/types/domain";

type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
type DiagnosisSessionRow = Database["public"]["Tables"]["diagnosis_sessions"]["Row"];
type ToolRow = Database["public"]["Tables"]["tools"]["Row"];

function mapUser(params: {
  id: string;
  email: string | null;
  createdAt: string;
  updatedAt: string;
}): User {
  return {
    id: params.id,
    telegramUserId: 0,
    telegramUsername: params.email,
    firstName: "User",
    lastName: null,
    languageCode: null,
    photoUrl: null,
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
  };
}

function mapCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    industry: row.industry,
    teamSize: row.team_size,
    revenueRange: row.revenue_range,
    description: row.description,
    primaryGoal: row.primary_goal,
    onboardingCompleted: row.onboarding_completed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDiagnosisSession(row: DiagnosisSessionRow): DiagnosisSession {
  return {
    id: row.id,
    companyId: row.company_id,
    questionSetId: row.question_set_id,
    status: row.status === "completed" ? "completed" : "in_progress",
    totalScore: row.total_score,
    summaryKey:
      row.summary_key === "low" || row.summary_key === "medium" || row.summary_key === "high"
        ? row.summary_key
        : null,
    createdAt: row.created_at,
    completedAt: row.completed_at,
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
  const currentUserId = await getCurrentUserId();

  console.log("DASHBOARD USER:", currentUserId);

  if (!currentUserId) {
    console.error("DASHBOARD COMPANY LOOKUP ERROR: missing current user id");
    return NextResponse.json({ error: "Пользователь не найден." }, { status: 401 });
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("*")
    .eq("user_id", currentUserId)
    .maybeSingle();

  if (companyError) {
    console.error("DASHBOARD COMPANY LOOKUP ERROR:", companyError);
    return NextResponse.json({ error: "Не удалось загрузить компанию." }, { status: 500 });
  }

  if (!company) {
    console.error("DASHBOARD COMPANY NOT FOUND:", {
      userId: currentUserId,
    });
    return NextResponse.json({ error: "Компания не найдена." }, { status: 404 });
  }

  console.log("DASHBOARD COMPANY:", {
    userId: currentUserId,
    companyId: company.id,
    companyUserId: company.user_id,
  });

  const [{ data: authUserResponse }, { data: latestDiagnosis }, { data: featuredTools }] =
    await Promise.all([
      supabase.auth.admin.getUserById(company.user_id),
      supabase
        .from("diagnosis_sessions")
        .select("*")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("tools")
        .select("*")
        .eq("is_featured", true)
        .order("created_at", { ascending: false })
        .limit(3),
    ]);

  const payload: DashboardResponse = {
    user: mapUser({
      id: company.user_id,
      email: authUserResponse.user?.email ?? null,
      createdAt: company.created_at,
      updatedAt: company.updated_at,
    }),
    company: mapCompany(company),
    latestDiagnosis: latestDiagnosis ? mapDiagnosisSession(latestDiagnosis) : null,
    featuredTools: (featuredTools ?? []).map(mapTool),
  };

  return NextResponse.json(payload);
}
