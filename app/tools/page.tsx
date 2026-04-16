import Link from "next/link";

import { getToolsLibrary } from "@/lib/tools";

export const dynamic = "force-dynamic";

export default async function ToolsPage() {
  const { categories, tools } = await getToolsLibrary();
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  return (
    <main className="page-shell">
      <section className="card">
        <span className="eyebrow">MVP v0.1</span>
        <h1>Инструменты</h1>
        <p className="muted">
          Библиотека инструментов, которые помогают разбирать слабые зоны бизнеса.
        </p>

        <div className="tool-stack">
          {tools.map((tool) => (
            <article key={tool.id} className="tool-card">
              <span className="eyebrow">
                {categoryById.get(tool.categoryId)?.name ?? "Инструмент"}
              </span>
              <h2>{tool.title}</h2>
              <p className="muted">{tool.summary}</p>
              {tool.problem ? <p>{tool.problem}</p> : null}
              <div className="tool-meta">
                {tool.format ? <span>{tool.format}</span> : null}
                {tool.estimatedMinutes ? <span>{tool.estimatedMinutes} мин</span> : null}
              </div>
              <Link href={`/tools/${tool.slug}`} className="button-link">
                Открыть
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
