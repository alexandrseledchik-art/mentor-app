import { getResultLevelText } from "@/lib/diagnosis/result-content";

export function ScoreCard({
  totalScore,
  summaryKey,
}: {
  totalScore: number | null;
  summaryKey: "low" | "medium" | "high" | null;
}) {
  return (
    <section>
      <h2>Ваш результат</h2>
      <div className="result-card">
        <div className="result-score">{totalScore ?? 0}</div>
        <div className="result-copy">
          <strong>{getResultLevelText(summaryKey)}</strong>
          <p className="muted">
            Это короткая оценка того, насколько бизнес сейчас работает как система.
          </p>
        </div>
      </div>
    </section>
  );
}
