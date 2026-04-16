export default async function ToolDetailsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <main className="page-shell">
      <section className="card">
        <span className="eyebrow">Инструмент</span>
        <h1>{slug}</h1>
        <p className="muted">
          Здесь будет страница отдельного инструмента из базы знаний.
        </p>
      </section>
    </main>
  );
}
