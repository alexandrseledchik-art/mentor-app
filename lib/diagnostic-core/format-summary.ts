import type { DiagnosticStructuredResult } from "./schema";

function list(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

export function formatDiagnosticSummary(result: DiagnosticStructuredResult) {
  const symptoms = result.symptoms.map((item) => item.text);
  const hypotheses = result.situationHypotheses.map(
    (item) => `${item.confidence === "working" ? "Рабочая" : "Слабая"} гипотеза: ${item.hypothesis}. Основание: ${item.basis}`,
  );
  const contours = result.causeContours.map(
    (item) =>
      `${item.contour}: проблема — ${item.hasProblem}, критичность — ${item.criticality}, роль — ${item.role}. ${item.basis}`,
  );
  const hypothesisChecks = result.hypothesisChecks.map((item) => {
    return [
      `Гипотеза: ${item.hypothesis}`,
      `Подтверждает: ${item.confirms.join("; ") || "пока нет подтверждений"}`,
      `Опровергнет: ${item.refutes.join("; ") || "пока не задано"}`,
      `Вопросы: ${item.questions.join("; ")}`,
    ].join("\n");
  });
  const doNotDo = result.doNotDoNow.map(
    (item) => `${item.action}. Почему кажется полезным: ${item.whyAttractive}. Почему не сейчас: ${item.whyNotNow}`,
  );

  return [
    "## Цель и симптомы",
    result.goal.primary
      ? `Цель: ${result.goal.primary}`
      : `Гипотезы цели:\n${list(result.goal.hypotheses)}`,
    `Пояснение: ${result.goal.explanation}`,
    `Симптомы:\n${list(symptoms)}`,
    "",
    "## Гипотезы ситуаций с уровнем уверенности",
    list(hypotheses),
    "",
    "## Контуры причин: где проблема и насколько критично",
    list(contours),
    "",
    "## Главное ограничение и доминирующие ситуации",
    `Главное ограничение: ${result.constraints.main ?? "не доказано"}`,
    result.constraints.secondary ? `Вторичное ограничение: ${result.constraints.secondary}` : null,
    result.constraints.tertiary ? `Третичное ограничение: ${result.constraints.tertiary}` : null,
    `Основание: ${result.constraints.basis}`,
    `Доминирующие ситуации:\n${list(result.dominantSituations.map((item) => `${item.name}: ${item.description}. Эффект: ${item.constraintEffect}`))}`,
    "",
    "## Проверка гипотез: что подтверждает, что может опровергнуть, какие вопросы задать",
    hypothesisChecks.join("\n\n"),
    "",
    "## Первая волна: направление, ожидаемые изменения, признаки успеха, цена ошибки",
    `Направления:\n${list(result.firstWave.directions)}`,
    `Ожидаемые изменения:\n${list(result.firstWave.expectedChanges)}`,
    `Признаки успеха:\n${list(result.firstWave.successSignals)}`,
    `Цена ошибки: ${result.firstWave.errorCost}`,
    `Основание: ${result.firstWave.basis}`,
    "",
    "## Вторая волна: после каких признаков первой, что закрепляем, какое узкое место предотвращаем",
    `Переходить после:\n${list(result.secondWave.transitionSignals)}`,
    `Закрепить:\n${list(result.secondWave.whatToConsolidate)}`,
    `Предотвратить:\n${list(result.secondWave.nextBottleneckToPrevent)}`,
    `Готовность к масштабированию: ${result.secondWave.scalingReadiness}`,
    `Основание: ${result.secondWave.basis}`,
    "",
    "## Что не делать сейчас",
    list(doNotDo),
    "",
    "## Короткий вывод для клиента",
    result.clientSummary,
  ]
    .filter((item): item is string => typeof item === "string" && item.length > 0)
    .join("\n\n");
}
