import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/types/db";
import type { Tool, ToolCategory } from "@/types/domain";

type ToolRow = Database["public"]["Tables"]["tools"]["Row"];
type ToolCategoryRow = Database["public"]["Tables"]["tool_categories"]["Row"];

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

function mapCategory(row: ToolCategoryRow): ToolCategory {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    position: row.position,
    createdAt: row.created_at,
  };
}

export async function getToolsLibrary() {
  const supabase = getSupabaseAdminClient();

  const [{ data: categories, error: categoriesError }, { data: tools, error: toolsError }] =
    await Promise.all([
      supabase.from("tool_categories").select("*").order("position", { ascending: true }),
      supabase.from("tools").select("*").order("is_featured", { ascending: false }).order("title"),
    ]);

  if (categoriesError) {
    throw categoriesError;
  }

  if (toolsError) {
    throw toolsError;
  }

  return {
    categories: (categories ?? []).map(mapCategory),
    tools: (tools ?? []).map(mapTool),
  };
}

export async function getToolBySlug(slug: string) {
  const supabase = getSupabaseAdminClient();

  const { data: tool, error } = await supabase
    .from("tools")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !tool) {
    return null;
  }

  return mapTool(tool);
}

export async function getToolsCatalogForEntry() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("tools")
    .select("slug, title, summary")
    .order("is_featured", { ascending: false })
    .order("title");

  if (error || !data) {
    return [];
  }

  return data.map((item) => ({
    slug: item.slug,
    title: item.title,
    summary: item.summary,
  }));
}
