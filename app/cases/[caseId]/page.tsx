import Link from "next/link";
import { notFound } from "next/navigation";

import { getCaseArtifactByShareToken } from "@/lib/cases/get-case-artifact";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function renderMarkdownLite(markdown: string) {
  const blocks = markdown.split(/\n{2,}/).filter(Boolean);

  return blocks.map((block, index) => {
    if (block.startsWith("## ")) {
      return <h2 key={index}>{block.replace(/^##\s+/, "")}</h2>;
    }

    if (block.startsWith("- ")) {
      return (
        <ul key={index} className="plain-list">
          {block.split("\n").map((item) => (
            <li key={item}>{item.replace(/^-\s+/, "")}</li>
          ))}
        </ul>
      );
    }

    return (
      <p key={index} className="case-paragraph">
        {block}
      </p>
    );
  });
}

export default async function CaseArtifactPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { caseId } = await params;
  const { token } = await searchParams;

  if (!token) {
    notFound();
  }

  const artifact = await getCaseArtifactByShareToken({
    caseId,
    token,
  });

  if (!artifact) {
    notFound();
  }

  return (
    <main className="page-shell">
      <section className="card">
        <span className="eyebrow">
          {artifact.artifactType === "preliminary_screening"
            ? "Предварительный скрининг"
            : artifact.artifactType === "diagnostic_intake"
              ? "Диагностический intake"
            : "Сохранённый разбор"}
        </span>
        <h1>{artifact.title}</h1>
        <p className="muted">
          Создано {formatDate(artifact.createdAt)}
          {artifact.completedAt ? ` · завершено ${formatDate(artifact.completedAt)}` : ""}
        </p>

        <div className="section-stack">
          <section className="result-card">
            <h2>Короткий вывод</h2>
            <p>{artifact.summary}</p>
          </section>

          <section className="case-markdown">
            {renderMarkdownLite(artifact.contentMarkdown)}
          </section>

          <div className="action-row">
            <Link href="/dashboard" className="button-link">
              В dashboard
            </Link>
            <Link href="/tools" className="button-link button-link-secondary">
              Инструменты
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
