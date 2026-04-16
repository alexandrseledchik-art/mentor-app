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
  const weakest = getWeakDimensions(dimensionScores)
    .slice()
    .sort((a, b) => a.averageScore - b.averageScore)
    .slice(0, 3);

  return weakest.map((item) => ({
    title: getDomainLabel(item.dimension),
    text:
      DOMAIN_START_TEXT[item.dimension] ??
      "Начните с этой зоны и сформулируйте первый конкретный шаг на ближайшую неделю",
  }));
}

export function getStrongDomains(dimensionScores: DiagnosisDimensionScore[]) {
  return dimensionScores
    .slice()
    .sort((a, b) => b.averageScore - a.averageScore)
    .slice(0, 2);
}
