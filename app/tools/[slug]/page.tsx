import Link from "next/link";
import { notFound } from "next/navigation";

import { getToolBySlug } from "@/lib/tools";

function renderContent(content: Record<string, unknown>) {
  const sections = Array.isArray(content.sections) ? content.sections : [];
  const items = Array.isArray(content.items) ? content.items : [];
  const fields = Array.isArray(content.fields) ? content.fields : [];
  const questions = Array.isArray(content.questions) ? content.questions : [];
  const columns = Array.isArray(content.columns) ? content.columns : [];

  if (
    sections.length === 0 &&
    items.length === 0 &&
    fields.length === 0 &&
    questions.length === 0 &&
    columns.length === 0
  ) {
    return <p className="muted">Подробное содержимое для этого инструмента пока не заполнено.</p>;
  }

  return (
    <div className="section-stack">
      {sections.length > 0
        ? sections.map((section, index) => {
            if (!section || typeof section !== "object" || Array.isArray(section)) {
              return null;
            }

            const sectionData = section as Record<string, unknown>;
            const title =
              typeof sectionData.title === "string" ? sectionData.title : `Раздел ${index + 1}`;
            const sectionItems = Array.isArray(sectionData.items) ? sectionData.items : [];

            return (
              <section key={`${title}-${index}`}>
                <h2>{title}</h2>
                <ul className="plain-list">
                  {sectionItems.map((item, itemIndex) => (
                    <li key={`${title}-${itemIndex}`}>{String(item)}</li>
                  ))}
                </ul>
              </section>
            );
          })
        : null}

      {items.length > 0 ? (
        <section>
          <h2>Чеклист</h2>
          <ul className="plain-list">
            {items.map((item, index) => (
              <li key={`item-${index}`}>{String(item)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {fields.length > 0 ? (
        <section>
          <h2>Что проработать</h2>
          <ul className="plain-list">
            {fields.map((item, index) => (
              <li key={`field-${index}`}>{String(item)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {questions.length > 0 ? (
        <section>
          <h2>Вопросы</h2>
          <ul className="plain-list">
            {questions.map((item, index) => (
              <li key={`question-${index}`}>{String(item)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {columns.length > 0 ? (
        <section>
          <h2>Структура</h2>
          <ul className="plain-list">
            {columns.map((item, index) => (
              <li key={`column-${index}`}>{String(item)}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export default async function ToolDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = await getToolBySlug(slug);

  if (!tool) {
    notFound();
  }

  return (
    <main className="page-shell">
      <section className="card">
        <span className="eyebrow">Инструмент</span>
        <h1>{tool.title}</h1>
        <p className="muted">{tool.summary}</p>
        {tool.problem ? (
          <section className="section-stack">
            <div>
              <h2>Когда нужен</h2>
              <p>{tool.problem}</p>
            </div>
          </section>
        ) : null}

        <div className="tool-meta">
          <span>{tool.format}</span>
          {tool.estimatedMinutes ? <span>{tool.estimatedMinutes} мин</span> : null}
          {tool.stage ? <span>{tool.stage}</span> : null}
        </div>

        {renderContent(tool.content)}

        <div className="action-row">
          <Link href="/tools" className="button-link button-link-secondary">
            Назад к библиотеке
          </Link>
        </div>
      </section>
    </main>
  );
}
