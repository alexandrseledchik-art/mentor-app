import type { DiagnosisDimensionScore } from "@/types/domain";

export const DOMAIN_LABELS: Record<string, string> = {
  owner: "Роль собственника",
  product: "Продукт",
  finance: "Финансы и контроль денег",
  governance: "Управление и принятие решений",
  technology: "Технологии",
  data: "Данные и аналитика",
  commercial: "Коммерция",
  external_environment: "Внешняя среда и рынок",
  strategy: "Стратегия и направление",
  team: "Команда и ответственность",
  operations: "Процессы и операционка",
};

export const DOMAIN_EXPLANATIONS: Record<string, string> = {
  owner:
    "значительная часть решений замкнута на владельце, из-за этого бизнес перегружен и медленнее масштабируется",
  product:
    "ценность продукта пока не собрана в чёткую и управляемую модель",
  finance:
    "по деньгам не хватает прозрачности и регулярного контроля",
  governance:
    "решения принимаются, но нет единой системы контроля и обратной связи",
  technology:
    "текущие инструменты не полностью поддерживают рост и масштаб",
  data:
    "данные есть, но используются ограниченно и не становятся основой решений",
  commercial:
    "коммерческий контур пока работает неровно, поэтому рост и выручка менее предсказуемы",
  external_environment:
    "компания пока слабо учитывает изменения рынка и внешней среды в решениях",
  strategy:
    "направление бизнеса пока не стало понятной опорой для ключевых решений",
  team:
    "ответственность в команде распределена не до конца ясно и не всегда держится стабильно",
  operations:
    "процессы пока сильно зависят от ручного управления и работают неравномерно",
};

export const DOMAIN_STRENGTH_TEXT: Record<string, string> = {
  commercial:
    "Коммерция: продажи и выручка уже в большей степени опираются на понятную и повторяемую систему",
  external_environment:
    "Внешняя среда и рынок: компания в целом чувствует изменения на рынке и учитывает их в решениях",
  owner:
    "Роль собственника: здесь уже появляется больше ясности в целях и границах решений",
  strategy:
    "Стратегия: направление бизнеса уже начинает работать как ориентир для решений",
  product:
    "Продукт: ценность продукта уже начинает складываться в более понятную систему",
  operations:
    "Операции: процессы становятся более повторяемыми и управляемыми",
  finance:
    "Финансы: по деньгам уже появляется базовая ясность и контроль",
  team:
    "Команда: работа с людьми становится более системной",
  governance:
    "Управление и риски: решения и контроль становятся более структурированными",
  technology:
    "Технологии: системы начинают лучше поддерживать работу бизнеса",
  data:
    "Данные и аналитика: данные начинают использоваться как основа для решений",
};

export const DOMAIN_START_TEXT: Record<string, string> = {
  technology:
    "Соберите список всех систем и инструментов и определите, где больше всего потерь и дублирования",
  owner:
    "Зафиксируйте, какие решения остаются у вас, а какие можно и нужно передать",
  product:
    "Коротко сформулируйте: для кого продукт, какую проблему он решает и в чём его ключевая ценность",
  finance:
    "Сведите в одном месте денежный поток, обязательные расходы и точки контроля по неделям",
  governance:
    "Определите один регулярный цикл управленческих встреч и правила фиксации решений",
  data:
    "Выберите несколько ключевых метрик, которые будут регулярно использоваться в управлении",
  commercial:
    "Разложите продажи на этапы и найдите, где сильнее всего теряется конверсия",
  external_environment:
    "Определите, какие внешние сигналы рынка нужно отслеживать регулярно",
  strategy:
    "Сформулируйте один главный фокус бизнеса на ближайший период и привяжите к нему решения",
  team:
    "Зафиксируйте зоны ответственности и владельцев по ключевым направлениям",
  operations:
    "Опишите несколько ключевых процессов, где чаще всего возникают сбои и потери",
};

export function getWeakDimensions(dimensionScores: DiagnosisDimensionScore[]) {
  return dimensionScores.filter((item) => item.averageScore <= 2);
}

function sortByWeakestFirst(dimensionScores: DiagnosisDimensionScore[]) {
  return dimensionScores.slice().sort((a, b) => a.averageScore - b.averageScore);
}

export function getDomainLabel(domain: string) {
  return DOMAIN_LABELS[domain] ?? domain;
}

export function getDomainExplanation(domain: string) {
  return (
    DOMAIN_EXPLANATIONS[domain] ??
    "эта зона пока работает менее управляемо, чем нужно для устойчивого роста"
  );
}

export function getDomainStrengthText(domain: string) {
  return (
    DOMAIN_STRENGTH_TEXT[domain] ??
    `${getDomainLabel(domain)}: здесь уже появляется больше устойчивости и управляемости`
  );
}

export function getStartSteps(dimensionScores: DiagnosisDimensionScore[]) {
  const weakest = sortByWeakestFirst(getWeakDimensions(dimensionScores)).slice(0, 3);

  const steps = weakest.map((item) => ({
    title: getDomainLabel(item.dimension),
    text:
      DOMAIN_START_TEXT[item.dimension] ??
      "Начните с этой зоны и сформулируйте первый конкретный шаг на ближайшую неделю",
  }));

  if (steps.length > 0) {
    return steps;
  }

  return [
    {
      title: "Точка контроля",
      text: "Зафиксируйте одну главную цель на ближайшие недели и договоритесь, по каким метрикам будете смотреть прогресс",
    },
    {
      title: "Управленческий ритм",
      text: "Введите короткий регулярный цикл обзора решений, цифр и узких мест, чтобы управление не уходило в ручной режим",
    },
  ];
}

export function getStrongDomains(dimensionScores: DiagnosisDimensionScore[]) {
  return dimensionScores
    .slice()
    .sort((a, b) => b.averageScore - a.averageScore)
    .slice(0, 2);
}

export function getPrimaryFocus(dimensionScores: DiagnosisDimensionScore[]) {
  const weakest = sortByWeakestFirst(getWeakDimensions(dimensionScores))[0];

  if (!weakest) {
    return "Собрать более чёткий управленческий ритм вокруг цифр, приоритетов и ответственности.";
  }

  return `${getDomainLabel(weakest.dimension)} — это главный контур, который сейчас стоит выровнять в первую очередь.`;
}

export function getFallbackMainSummary(dimensionScores: DiagnosisDimensionScore[]) {
  const weakest = sortByWeakestFirst(getWeakDimensions(dimensionScores));
  const strongest = getStrongDomains(dimensionScores);

  if (weakest.length === 0) {
    return "Сейчас бизнес выглядит достаточно собранным: критически слабых зон по этой диагностике не видно. Дальше важнее не потерять управляемость и закрепить то, что уже начинает работать как система.";
  }

  const weakestLabels = weakest.slice(0, 2).map((item) => getDomainLabel(item.dimension));
  const strongestLabel = strongest[0] ? getDomainLabel(strongest[0].dimension) : null;
  const weakestText =
    weakestLabels.length === 1
      ? weakestLabels[0]
      : `${weakestLabels[0]} и ${weakestLabels[1]}`;

  const strongText = strongestLabel
    ? ` При этом уже есть контур, на который можно опереться: ${strongestLabel.toLowerCase()}.`
    : "";

  return `Сейчас бизнес частично держится на системе, но сильнее всего управляемость проседает в зоне «${weakestText}». Именно здесь решения, рост и ежедневная работа сильнее завязаны на ручное управление.${strongText}`;
}

export function getFallbackWhyNow(dimensionScores: DiagnosisDimensionScore[]) {
  const weakest = sortByWeakestFirst(getWeakDimensions(dimensionScores));

  if (weakest.length === 0) {
    return "Когда явных провалов нет, главный риск — расслабиться и снова вернуть управление в ручной режим. Сейчас полезно закрепить сильные контуры и не дать им расползтись.";
  }

  const firstWeak = weakest[0];
  const secondWeak = weakest[1];
  const firstLabel = getDomainLabel(firstWeak.dimension);
  const secondLabel = secondWeak ? getDomainLabel(secondWeak.dimension) : null;

  if (secondLabel) {
    return `Пока не выровнены «${firstLabel}» и «${secondLabel}», рост будет оставаться менее предсказуемым, а часть решений продолжит упираться в ручное управление. Это замедляет скорость компании и мешает закрепить результат.`;
  }

  return `Пока не выровнен контур «${firstLabel}», бизнес будет терять управляемость именно там, где сейчас нужен самый быстрый прогресс. Это ограничивает скорость решений и делает рост более хрупким.`;
}

export function getToolOutcome(tool: { title: string; summary: string }) {
  if (tool.summary.trim().length > 0) {
    return `На выходе у вас будет более понятный и применимый способ закрыть задачу в этой зоне, а не держать её в ручном режиме.`;
  }

  return `На выходе у вас появится конкретный рабочий ориентир, который поможет быстрее перевести эту зону в более управляемое состояние.`;
}
