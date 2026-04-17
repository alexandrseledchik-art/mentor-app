"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import type {
  ResultToolExplainApiResponse,
  ResultToolsApiResponse,
} from "@/types/api";
import type { ResultRecommendedToolItem } from "@/types/domain";

type ResultToolsPanelProps = {
  toolsUrl: string;
  explainBaseUrl: string;
};

export function ResultToolsPanel({ toolsUrl, explainBaseUrl }: ResultToolsPanelProps) {
  const pathname = usePathname();
  const [isLoadingTools, setIsLoadingTools] = useState(true);
  const [toolsError, setToolsError] = useState<string | null>(null);
  const [tools, setTools] = useState<ResultRecommendedToolItem[]>([]);
  const [selectedTool, setSelectedTool] = useState<ResultRecommendedToolItem | null>(null);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [explanationError, setExplanationError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<ResultToolExplainApiResponse | null>(null);

  async function loadTools() {
    setIsLoadingTools(true);
    setToolsError(null);

    try {
      const response = await fetch(toolsUrl, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        setToolsError("Не удалось загрузить рекомендованные инструменты.");
        return;
      }

      const payload = (await response.json()) as ResultToolsApiResponse;
      setTools(payload.items);
      setSelectedTool((current) => current ?? payload.items[0] ?? null);
    } catch {
      setToolsError("Не удалось загрузить рекомендованные инструменты.");
    } finally {
      setIsLoadingTools(false);
    }
  }

  async function loadExplanation(tool: ResultRecommendedToolItem) {
    setIsLoadingExplanation(true);
    setExplanationError(null);

    try {
      const response = await fetch(`${explainBaseUrl}/${tool.slug}/explain`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        setExplanationError("Не удалось получить объяснение по инструменту.");
        return;
      }

      setExplanation((await response.json()) as ResultToolExplainApiResponse);
    } catch {
      setExplanationError("Не удалось получить объяснение по инструменту.");
    } finally {
      setIsLoadingExplanation(false);
    }
  }

  useEffect(() => {
    void loadTools();
  }, [toolsUrl]);

  useEffect(() => {
    setExplanation(null);
    setExplanationError(null);
  }, [selectedTool?.slug]);

  const buildToolHref = (slug: string) => {
    const from = pathname && pathname.length > 0 ? pathname : "/tools";
    return `/tools/${slug}?from=${encodeURIComponent(from)}`;
  };

  return (
    <section>
      <h2>С чего начать</h2>
      <p className="muted">
        Здесь собраны инструменты, которые уже детерминированно подходят к вашему результату.
        Сначала поймите, почему инструмент релевантен, потом откройте его и работайте с ним отдельно.
      </p>

      {isLoadingTools ? <p className="muted">Загружаем рекомендованные инструменты...</p> : null}

      {toolsError ? (
        <div className="section-stack">
          <p className="muted">{toolsError}</p>
          <div className="action-row">
            <button type="button" onClick={() => void loadTools()} disabled={isLoadingTools}>
              Повторить
            </button>
          </div>
        </div>
      ) : null}

      {tools.length > 0 ? (
        <div className="tool-stack">
          {tools.map((tool) => {
            const isSelected = selectedTool?.slug === tool.slug;

            return (
              <article key={tool.slug} className="tool-card">
                <h3>{tool.title}</h3>
                <p>{tool.whyRecommended}</p>
                <div className="action-row">
                  <button
                    type="button"
                    onClick={() => setSelectedTool(tool)}
                    disabled={isSelected}
                  >
                    {isSelected ? "Выбран" : "Выбрать"}
                  </button>
                  <Link href={buildToolHref(tool.slug)} className="button-link button-link-secondary">
                    Открыть инструмент
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {selectedTool ? (
        <div className="section-stack">
          <section>
            <h3>{selectedTool.title}</h3>
            <p className="muted">{selectedTool.whyRecommended}</p>
            <div className="action-row">
              <button
                type="button"
                onClick={() => void loadExplanation(selectedTool)}
                disabled={isLoadingExplanation}
              >
                {isLoadingExplanation ? "Разбираем..." : "Почему этот инструмент"}
              </button>
              <Link href={buildToolHref(selectedTool.slug)} className="button-link">
                Открыть инструмент
              </Link>
            </div>
          </section>

          {explanationError ? (
            <div className="section-stack">
              <p className="muted">{explanationError}</p>
              <div className="action-row">
                <button
                  type="button"
                  onClick={() => void loadExplanation(selectedTool)}
                  disabled={isLoadingExplanation}
                >
                  Повторить
                </button>
              </div>
            </div>
          ) : null}

          {explanation ? (
            <>
              <section>
                <h3>Почему сейчас</h3>
                <p>{explanation.whyThisTool}</p>
              </section>

              <section>
                <h3>Какую проблему решает</h3>
                <ul className="plain-list">
                  {explanation.whatProblemItSolves.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h3>Где применять</h3>
                <ul className="plain-list">
                  {explanation.whereToApply.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h3>Что подготовить</h3>
                <ul className="plain-list">
                  {explanation.whatToPrepare.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h3>Чего не делать</h3>
                <ul className="plain-list">
                  {explanation.commonMistakes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h3>Ожидаемый результат</h3>
                <p>{explanation.expectedOutcome}</p>
              </section>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
