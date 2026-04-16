import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { DashboardResponse } from "@/types/api";
import type { Database } from "@/types/db";
import type { Company, DiagnosisSession, Tool, User } from "@/types/domain";

type UserRow = Database["public"]["Tables"]["users"]["Row"];
type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
type DiagnosisSessionRow = Database["public"]["Tables"]["diagnosis_sessions"]["Row"];
type ToolRow = Database["public"]["Tables"]["tools"]["Row"];

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    telegramUserId: row.telegram_user_id,
    telegramUsername: row.telegram_username,
    firstName: row.first_name,
    lastName: row.last_name,
    languageCode: row.language_code,
    photoUrl: row.photo_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (companyError) {
    return NextResponse.json({ error: "Не удалось загрузить компанию." }, { status: 500 });
  }

  if (!company) {
    return NextResponse.json({ error: "Компания не найдена." }, { status: 404 });
  }

  const [{ data: user }, { data: latestDiagnosis }, { data: featuredTools }] = await Promise.all([
    supabase.from("users").select("*").eq("id", company.user_id).maybeSingle(),
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
    user: user ? mapUser(user) : mapUser({
      id: company.user_id,
      telegram_user_id: 0,
      telegram_username: null,
      first_name: "Demo",
      last_name: null,
      language_code: null,
      photo_url: null,
      created_at: company.created_at,
      updated_at: company.updated_at,
    }),
    company: mapCompany(company),
    latestDiagnosis: latestDiagnosis ? mapDiagnosisSession(latestDiagnosis) : null,
    featuredTools: (featuredTools ?? []).map(mapTool),
  };

  return NextResponse.json(payload);
}
