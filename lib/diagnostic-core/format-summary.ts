import type { DiagnosticStructuredResult } from "./schema";

function list(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

export function formatDiagnosticSummary(result: DiagnosticStructuredResult) {
  const symptoms = result.symptoms.map((item) => item.text);
  const hypotheses = result.situationHypotheses.map(
    (item) => `${item.confidence === "working" ? "Рабочая" : "Слабая"} гипотеза: ${item.hypothesis}. Основание: ${item.basis}`,
  );
  const contours = (result.causeContours ?? []).map(
    (item) =>
      `${item.contour}: проблема — ${item.hasProblem}, критичность — ${item.criticality}, роль — ${item.role}. ${item.basis}`,
  );
  const dominantSituations = (result.dominantSituations ?? []).map(
    (item) => `${item.name}: ${item.description}. Эффект: ${item.constraintEffect}`,
  );
  const hypothesisChecks = (result.hypothesisChecks ?? []).map((item) =>
    [
      `Гипотеза: ${item.hypothesis}`,
      item.confirms.length > 0 ? `Подтверждает: ${item.confirms.join("; ")}` : null,
      item.refutes.length > 0 ? `Опровергнет: ${item.refutes.join("; ")}` : null,
      `Вопросы: ${item.questions.join("; ")}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  const doNotDo = (result.doNotDoNow ?? []).map(
    (item) => `${item.action}. Почему не сейчас: ${item.whyNotNow}`,
  );

  return [
    "## Картина",
    result.goal.primary
      ? `Цель: ${result.goal.primary}`
      : result.goal.hypotheses.length > 0
        ? `Гипотезы цели:\n${list(result.goal.hypotheses)}`
        : null,
    result.goal.explanation ? `Почему это важно: ${result.goal.explanation}` : null,
    symptoms.length > 0 ? `Симптомы:\n${list(symptoms)}` : null,
    hypotheses.length > 0 ? `Гипотезы:\n${list(hypotheses)}` : null,
    contours.length > 0 ? `Контуры:\n${list(contours)}` : null,
    "",
    "## Ограничение",
    `Главное: ${result.constraints.main ?? "не доказано"}`,
    result.constraints.secondary ? `Вторичное: ${result.constraints.secondary}` : null,
    result.constraints.tertiary ? `Третичное: ${result.constraints.tertiary}` : null,
    result.constraints.basis ? `Почему так: ${result.constraints.basis}` : null,
    dominantSituations.length > 0 ? `Ситуации:\n${list(dominantSituations)}` : null,
    result.constraints.competingVersions.length > 0
      ? `Конкурирующие версии:\n${list(result.constraints.competingVersions)}`
      : null,
    hypothesisChecks.length > 0 ? "" : null,
    hypothesisChecks.length > 0 ? "## Что проверить" : null,
    hypothesisChecks.length > 0 ? hypothesisChecks.join("\n\n") : null,
    "",
    "## Первый ход",
    `Направления:\n${list(result.firstWave.directions)}`,
    result.firstWave.expectedChanges.length > 0
      ? `Что должно измениться:\n${list(result.firstWave.expectedChanges)}`
      : null,
    result.firstWave.successSignals.length > 0
      ? `Признаки результата:\n${list(result.firstWave.successSignals)}`
      : null,
    result.firstWave.errorCost ? `Цена ошибки: ${result.firstWave.errorCost}` : null,
    result.firstWave.basis ? `Почему именно это: ${result.firstWave.basis}` : null,
    result.secondWave ? "" : null,
    result.secondWave ? "## После этого" : null,
    result.secondWave?.transitionSignals?.length
      ? `Переходить после:\n${list(result.secondWave.transitionSignals)}`
      : null,
    result.secondWave?.whatToConsolidate?.length
      ? `Закрепить:\n${list(result.secondWave.whatToConsolidate)}`
      : null,
    result.secondWave?.nextBottleneckToPrevent?.length
      ? `Не допустить дальше:\n${list(result.secondWave.nextBottleneckToPrevent)}`
      : null,
    result.secondWave?.scalingReadiness
      ? `Готовность к расширению: ${result.secondWave.scalingReadiness}`
      : null,
    result.secondWave?.basis ? `Почему так: ${result.secondWave.basis}` : null,
    doNotDo.length > 0 ? "" : null,
    doNotDo.length > 0 ? "## Не делать сейчас" : null,
    doNotDo.length > 0 ? list(doNotDo) : null,
    "",
    "## Вывод",
    result.clientSummary,
  ]
    .filter((item): item is string => typeof item === "string" && item.length > 0)
    .join("\n\n");
}
