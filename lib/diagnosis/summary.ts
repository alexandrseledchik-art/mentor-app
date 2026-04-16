import type {
  DiagnosisAnswerInput,
  DiagnosisDimensionScore,
  DiagnosisQuestion,
  DiagnosisResultSummary,
} from "@/types/domain";
import { getDimensionStrength } from "@/lib/diagnosis/result-content";

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

export function calculateDiagnosisTotalScore(
  answers: DiagnosisAnswerInput[],
  questions: DiagnosisQuestion[],
) {
  const weightByQuestionId = new Map(
    questions.map((question) => [question.id, question.weight]),
  );

  return answers.reduce((sum, answer) => {
    const weight = weightByQuestionId.get(answer.questionId) ?? 1;
    return sum + answer.answerValue * weight;
  }, 0);
}

export function calculateDimensionScores(
  answers: DiagnosisAnswerInput[],
  questions: DiagnosisQuestion[],
): DiagnosisDimensionScore[] {
  const grouped = new Map<string, { total: number; count: number }>();

  for (const answer of answers) {
    const question = questions.find((item) => item.id === answer.questionId);

    if (!question) {
      continue;
    }

    const current = grouped.get(question.dimension) ?? { total: 0, count: 0 };
    current.total += answer.answerValue;
    current.count += 1;
    grouped.set(question.dimension, current);
  }

  return Array.from(grouped.entries()).map(([dimension, value]) => ({
    dimension,
    averageScore: roundToOneDecimal(value.total / value.count),
  }));
}

function buildLowSummary(dimensionScores: DiagnosisDimensionScore[]): DiagnosisResultSummary {
  const weakest = [...dimensionScores]
    .sort((a, b) => a.averageScore - b.averageScore)
    .slice(0, 2)
    .map((item) => item.dimension);

  return {
    key: "low",
    title: "Система пока держится на ручном управлении",
    description:
      "В бизнесе уже есть база, но многие решения и процессы зависят от людей и ситуации.",
    strengths: ["Есть точки роста, на которые можно быстро опереться."],
    risks: weakest.length
      ? weakest.map(
          (dimension) => `Слабое место сейчас: ${dimension}.`,
        )
      : ["Нужно выровнять базовые процессы и приоритеты."],
  };
}

function buildMediumSummary(
  dimensionScores: DiagnosisDimensionScore[],
): DiagnosisResultSummary {
  const strongest = [...dimensionScores]
    .sort((a, b) => b.averageScore - a.averageScore)
    .slice(0, 2)
    .map((item) => item.dimension);

  return {
    key: "medium",
    title: "У бизнеса уже есть рабочая основа",
    description:
      "Главные элементы управления уже собраны, но еще не везде работают одинаково стабильно.",
    strengths: strongest.length
      ? strongest.map((dimension) => getDimensionStrength(dimension))
      : ["Часть системы уже работает устойчиво."],
    risks: ["Рост может замедляться там, где процессы еще не доведены до системы."],
  };
}

function buildHighSummary(
  dimensionScores: DiagnosisDimensionScore[],
): DiagnosisResultSummary {
  const strongest = [...dimensionScores]
    .sort((a, b) => b.averageScore - a.averageScore)
    .slice(0, 2)
    .map((item) => item.dimension);

  return {
    key: "high",
    title: "Бизнес выглядит управляемым и зрелым",
    description:
      "У компании уже есть сильная управленческая база, на которую можно уверенно опираться.",
    strengths: strongest.length
      ? strongest.map((dimension) => getDimensionStrength(dimension))
      : ["Ключевые контуры бизнеса работают стабильно."],
    risks: ["Следующий шаг - не терять фокус и усиливать самые важные зоны роста."],
  };
}

export function buildDiagnosisSummary(
  answers: DiagnosisAnswerInput[],
  questions: DiagnosisQuestion[],
): DiagnosisResultSummary {
  const dimensionScores = calculateDimensionScores(answers, questions);
  const totalScore = calculateDiagnosisTotalScore(answers, questions);
  const maxScore = questions.reduce((sum, question) => sum + question.weight * 5, 0);
  const ratio = maxScore === 0 ? 0 : totalScore / maxScore;

  if (ratio < 0.45) {
    return buildLowSummary(dimensionScores);
  }

  if (ratio < 0.75) {
    return buildMediumSummary(dimensionScores);
  }

  return buildHighSummary(dimensionScores);
}
