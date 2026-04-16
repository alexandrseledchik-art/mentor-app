"use client";

import { getToolOutcome } from "./result-copy";

import type { RecommendedTool } from "@/types/domain";

export function ResultTools({ tools }: { tools: RecommendedTool[] }) {
  if (tools.length === 0) {
    return (
      <section>
        <h2>Рекомендуемые инструменты</h2>
        <p className="muted">
          Пока для этого результата нет точных инструментов из базы знаний. Но уже сейчас видно, какие зоны стоит разбирать в первую очередь, и к инструментам можно вернуться после следующего обновления диагностики.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2>Рекомендуемые инструменты</h2>
      <div className="tool-stack">
        {tools.map((tool) => (
          <article key={tool.id} className="tool-card">
            <h3>{tool.title}</h3>
            <p>
              <strong>Почему рекомендован:</strong> {tool.whyRecommended}
            </p>
            <p>
              <strong>Какую задачу закрывает:</strong> {tool.summary}
            </p>
            <p>
              <strong>Что даст на выходе:</strong> {getToolOutcome(tool)}
            </p>
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
