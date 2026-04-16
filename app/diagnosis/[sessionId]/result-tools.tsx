"use client";

import type { RecommendedTool } from "@/types/domain";

export function ResultTools({ tools }: { tools: RecommendedTool[] }) {
  if (tools.length === 0) {
    return null;
  }

  return (
    <section>
      <h2>Рекомендуемые инструменты</h2>
      <div className="tool-stack">
        {tools.map((tool) => (
          <article key={tool.id} className="tool-card">
            <h3>{tool.title}</h3>
            <p className="muted">{tool.summary}</p>
            <button
              type="button"
              onClick={() => window.open(tool.externalUrl, "_blank")}
            >
              Открыть
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
