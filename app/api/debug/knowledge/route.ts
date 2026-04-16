import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase/server";

function pickRandom<T>(items: T[], count: number) {
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const supabase = getSupabaseAdminClient();

  const [
    toolsCountResult,
    symptomsCountResult,
    mapCountResult,
    toolsResult,
    symptomsResult,
    mapResult,
  ] = await Promise.all([
    supabase.from("tools").select("*", { count: "exact", head: true }),
    supabase.from("symptoms").select("*", { count: "exact", head: true }),
    supabase.from("symptom_tool_map").select("*", { count: "exact", head: true }),
    supabase.from("tools").select("id, slug, title").limit(50),
    supabase.from("symptoms").select("id, slug, title, section").limit(50),
    supabase
      .from("symptom_tool_map")
      .select(
        `
          id,
          priority,
          symptom:symptoms(title, slug),
          tool:tools(title, slug)
        `,
      )
      .limit(50),
  ]);

  const error =
    toolsCountResult.error ??
    symptomsCountResult.error ??
    mapCountResult.error ??
    toolsResult.error ??
    symptomsResult.error ??
    mapResult.error;

  if (error) {
    return NextResponse.json(
      { error: "Failed to load knowledge debug info.", details: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    counts: {
      tools: toolsCountResult.count ?? 0,
      symptoms: symptomsCountResult.count ?? 0,
      symptom_tool_map: mapCountResult.count ?? 0,
    },
    random_tools: pickRandom(toolsResult.data ?? [], 3),
    random_symptoms: pickRandom(symptomsResult.data ?? [], 3),
    random_mappings: pickRandom(mapResult.data ?? [], 3),
  });
}
