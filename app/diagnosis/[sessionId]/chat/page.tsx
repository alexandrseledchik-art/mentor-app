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
        <span className="eyebrow">AI Chat After Diagnosis</span>
        <h1>Разобрать результат с ИИ</h1>
        <p className="muted">
          Здесь можно задать вопросы по вашему результату и быстро перевести выводы в действия.
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
