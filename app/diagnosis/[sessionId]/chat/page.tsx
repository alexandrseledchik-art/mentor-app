import Link from "next/link";

import { DiagnosisChatPanel } from "./chat-panel";

export default async function DiagnosisChatPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  return (
    <main className="page-shell">
      <section className="card">
        <span className="eyebrow">Разбор результата</span>
        <h1>Разбор результата диагностики</h1>
        <p className="muted">
          Поймём, что ограничивает рост, и определим первые шаги.
        </p>

        <div className="action-row">
          <Link className="button-link button-link-secondary" href={`/diagnosis/${sessionId}`}>
            Вернуться к результату
          </Link>
        </div>

        <DiagnosisChatPanel sessionId={sessionId} />
      </section>
    </main>
  );
}
