import type { DiagnosisDimensionScore } from "@/types/domain";

const dimensionTitleMap: Record<string, string> = {
  owner: "Роль собственника",
  external_environment: "Рынок и внешняя среда",
  strategy: "Стратегия и направление",
  product: "Продукт",
  commercial: "Продажи и маркетинг",
  operations: "Процессы и операционка",
  finance: "Финансы и контроль денег",
  team: "Команда и ответственность",
  governance: "Управление и принятие решений",
  technology: "Технологии",
  data: "Данные и аналитика",
};

const dimensionMeaningMap: Record<string, string> = {
  owner: "собственник пока держит слишком многое на себе",
  external_environment: "компания слабо отслеживает, что меняется вокруг",
  strategy: "нет четкого направления и общего фокуса",
  product: "ценность продукта для клиента пока не собрана в ясную систему",
  commercial: "продажи и привлечение работают нестабильно",
  operations: "процессы зависят от ручного управления",
  finance: "по деньгам пока не хватает ясности и контроля",
  team: "команда не всегда берет ответственность на себя",
  governance: "решения и контроль работают несистемно",
  technology: "технологии пока не поддерживают рост достаточно хорошо",
  data: "данные есть, но в управлении используются слабо",
};

const dimensionStartMap: Record<string, string> = {
  owner: "Зафиксируйте, какие решения собственник оставляет себе, а какие передает.",
  external_environment: "Определите 3-5 внешних факторов, которые нужно смотреть каждую неделю.",
  strategy: "Сформулируйте один главный фокус бизнеса на ближайшие 3 месяца.",
  product: "Соберите коротко: для кого продукт, какую проблему решает и в чем ценность.",
  commercial: "Разложите продажи на этапы и найдите самое слабое место в воронке.",
  operations: "Опишите 2-3 ключевых процесса, которые чаще всего дают сбои.",
  finance: "Сведите в одном месте выручку, расходы и денежный остаток по неделям.",
  team: "Назначьте владельцев по ключевым зонам и зафиксируйте их ответственность.",
  governance: "Введите один регулярный ритм встреч с решениями и фиксацией итогов.",
  technology: "Соберите список основных систем и найдите, что мешает работе чаще всего.",
  data: "Выберите 5 главных метрик, по которым будете смотреть бизнес каждую неделю.",
};

const dimensionStrengthMap: Record<string, string> = {
  commercial:
    "Коммерция: продажи и выручка сейчас опираются на более собранную систему, чем большинство других контуров.",
  external_environment:
    "Внешняя среда и рынок: компания уже неплохо чувствует рынок и в целом учитывает внешние изменения в решениях.",
  owner:
    "Роль собственника: здесь уже появляется больше ясности в целях и границах решений.",
  strategy:
    "Стратегия: направление бизнеса уже начинает работать как ориентир для решений.",
  product:
    "Продукт: ценность продукта уже начинает складываться в более понятную систему.",
  operations:
    "Операции: процессы уже становятся более повторяемыми и управляемыми.",
  finance:
    "Финансы: по деньгам уже появляется базовая ясность и управляемость.",
  team:
    "Команда: работа с людьми уже выстраивается более системно.",
  governance:
    "Управление и риски: решения и контроль уже начинают работать более собранно.",
  technology:
    "Технологии: основные системы уже в большей степени поддерживают работу бизнеса.",
  data:
    "Данные и аналитика: данные уже начинают использоваться как опора для решений.",
};

export function getWeakDimensions(dimensionScores: DiagnosisDimensionScore[]) {
  return dimensionScores.filter((item) => item.averageScore <= 2);
}

export function getDimensionTitle(dimension: string) {
  return dimensionTitleMap[dimension] ?? dimension;
}

export function getDimensionMeaning(dimension: string) {
  return dimensionMeaningMap[dimension] ?? "эта зона пока работает нестабильно";
}

export function getResultLevelText(summaryKey: "low" | "medium" | "high" | null) {
  if (summaryKey === "low") {
    return "Низкий уровень системности";
  }

  if (summaryKey === "high") {
    return "Высокий уровень системности";
  }

  return "Средний уровень системности";
}

export function getDimensionStrength(dimension: string) {
  return (
    dimensionStrengthMap[dimension] ??
    `${getDimensionTitle(dimension)}: эта зона уже выглядит более собранной и устойчивой.`
  );
}

export function buildStartSteps(dimensionScores: DiagnosisDimensionScore[]) {
  const weakDimensions = getWeakDimensions(dimensionScores)
    .slice()
    .sort((a, b) => a.averageScore - b.averageScore)
    .slice(0, 3);

  if (weakDimensions.length === 0) {
    return [
      {
        title: "Текущая система",
        text: "Проверьте, какие сильные практики уже работают стабильно, и закрепите их.",
      },
      {
        title: "Следующая точка роста",
        text: "Выберите одну зону роста, которая даст быстрый эффект в ближайший месяц.",
      },
      {
        title: "Повторная проверка",
        text: "Запланируйте повторную диагностику после первых изменений.",
      },
    ];
  }

  return weakDimensions.map((item) => ({
    title: getDimensionTitle(item.dimension),
    text:
      dimensionStartMap[item.dimension] ??
      "Начните с самой слабой зоны и опишите первый простой шаг.",
  }));
}
