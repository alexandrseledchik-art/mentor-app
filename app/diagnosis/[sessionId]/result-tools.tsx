"use client";

import type { ResultRecommendedTool } from "@/types/domain";

export function ResultTools({ tools }: { tools: ResultRecommendedTool[] }) {
  if (tools.length === 0) {
    return null;
  }

  return (
    <section>
      <h2>Рекомендованные вам инструменты</h2>
      <div className="tool-stack">
        {tools.map((tool, index) => (
          <article
            key={`${tool.source}-${tool.title}-${index}`}
            className="tool-card"
          >
            <h3>{tool.title}</h3>
            <p>
              <strong>Почему сейчас:</strong> {tool.whyNow}
            </p>
            <p>
              <strong>Что прояснит:</strong> {tool.whatItClarifies}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
