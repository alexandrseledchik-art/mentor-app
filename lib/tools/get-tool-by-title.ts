import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Database } from "@/types/db";
import type { Tool } from "@/types/domain";

type ToolRow = Database["public"]["Tables"]["tools"]["Row"];

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

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function getToolBySlug(toolSlug: string): Promise<Tool | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("tools")
    .select("*")
    .eq("slug", toolSlug)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapTool(data as ToolRow);
}

export async function getToolByTitle(title: string): Promise<Tool | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("tools")
    .select("*")
    .order("title");

  if (error || !data?.length) {
    return null;
  }

  const normalizedTitle = normalize(title);
  const exact = (data as ToolRow[]).find((item) => normalize(item.title) === normalizedTitle);

  if (exact) {
    return mapTool(exact);
  }

  const partial = (data as ToolRow[]).find((item) => {
    const toolTitle = normalize(item.title);
    return toolTitle.includes(normalizedTitle) || normalizedTitle.includes(toolTitle);
  });

  return partial ? mapTool(partial) : null;
}
