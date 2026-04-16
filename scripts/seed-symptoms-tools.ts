const fs = require("node:fs/promises") as typeof import("node:fs/promises");
const path = require("node:path") as typeof import("node:path");
const { createClient } =
  require("@supabase/supabase-js") as typeof import("@supabase/supabase-js");

type SeedToolCategory = {
  slug: string;
  name: string;
  description: string;
  position: number;
};

type SeedTool = {
  slug: string;
  title: string;
};

type SeedSymptom = {
  slug: string;
  title: string;
  section: string;
  reason: string | null;
};

type SeedSymptomToolMap = {
  symptom_slug: string;
  tool_slug: string;
  priority: number;
};

type SeedPayload = {
  toolCategory: SeedToolCategory;
  tools: SeedTool[];
  symptoms: SeedSymptom[];
  symptomToolMap: SeedSymptomToolMap[];
};

async function readSeedPayload(): Promise<SeedPayload> {
  const filePath = path.resolve(
    process.cwd(),
    "data",
    "symptoms-tools.seed.json",
  );
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as SeedPayload;
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Missing required env vars: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY.",
    );
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    const seed = await readSeedPayload();

    const { data: categoryRows, error: categoryError } = await supabase
      .from("tool_categories")
      .upsert(seed.toolCategory, {
        onConflict: "slug",
      })
      .select("id, slug")
      .eq("slug", seed.toolCategory.slug);

    if (categoryError || !categoryRows?.[0]) {
      console.error("Failed to upsert tool category.", categoryError);
      process.exitCode = 1;
      return;
    }

    const categoryId = categoryRows[0].id;

    const toolRows = seed.tools.map((tool) => ({
      category_id: categoryId,
      slug: tool.slug,
      title: tool.title,
      summary: "Инструмент из базы знаний по симптомам бизнеса.",
      format: "guide",
      content: {},
    }));

    const { error: toolsError } = await supabase.from("tools").upsert(toolRows, {
      onConflict: "slug",
    });

    if (toolsError) {
      console.error("Failed to upsert tools.", toolsError);
      process.exitCode = 1;
      return;
    }

    console.log(`Tools upserted: ${toolRows.length}`);

    const { error: symptomsError } = await supabase
      .from("symptoms")
      .upsert(seed.symptoms, {
        onConflict: "slug",
      });

    if (symptomsError) {
      console.error("Failed to upsert symptoms.", symptomsError);
      process.exitCode = 1;
      return;
    }

    console.log(`Symptoms upserted: ${seed.symptoms.length}`);

    const [{ data: toolsLookup, error: toolsLookupError }, { data: symptomsLookup, error: symptomsLookupError }] =
      await Promise.all([
        supabase.from("tools").select("id, slug").in(
          "slug",
          seed.tools.map((tool) => tool.slug),
        ),
        supabase.from("symptoms").select("id, slug").in(
          "slug",
          seed.symptoms.map((symptom) => symptom.slug),
        ),
      ]);

    if (toolsLookupError) {
      console.error("Failed to read tools after upsert.", toolsLookupError);
      process.exitCode = 1;
      return;
    }

    if (symptomsLookupError) {
      console.error("Failed to read symptoms after upsert.", symptomsLookupError);
      process.exitCode = 1;
      return;
    }

    const toolIdBySlug = new Map(
      (toolsLookup ?? []).map((tool) => [tool.slug, tool.id]),
    );
    const symptomIdBySlug = new Map(
      (symptomsLookup ?? []).map((symptom) => [symptom.slug, symptom.id]),
    );

    const missingToolSlug = seed.symptomToolMap.find(
      (item) => !toolIdBySlug.has(item.tool_slug),
    )?.tool_slug;
    const missingSymptomSlug = seed.symptomToolMap.find(
      (item) => !symptomIdBySlug.has(item.symptom_slug),
    )?.symptom_slug;

    if (missingToolSlug || missingSymptomSlug) {
      console.error("Missing linked records after upsert.", {
        missingToolSlug,
        missingSymptomSlug,
      });
      process.exitCode = 1;
      return;
    }

    const mapRows = seed.symptomToolMap.map((item) => ({
      symptom_id: symptomIdBySlug.get(item.symptom_slug)!,
      tool_id: toolIdBySlug.get(item.tool_slug)!,
      priority: item.priority,
    }));

    const { error: mapError } = await supabase
      .from("symptom_tool_map")
      .upsert(mapRows, {
        onConflict: "symptom_id,tool_id",
      });

    if (mapError) {
      console.error("Failed to upsert symptom-tool links.", mapError);
      process.exitCode = 1;
      return;
    }

    console.log(`Symptom-tool links upserted: ${mapRows.length}`);
    console.log("Knowledge base seed completed.");
  } catch (error) {
    console.error("Seed script failed with an unexpected error.");
    console.error(error);
    process.exitCode = 1;
  }
}

void main();
