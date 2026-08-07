/**
 * Catálogo de widgets del panel (Oportunidades). Cada entrada dice qué gráfico
 * dibujar (`kind`) y de qué métrica se alimenta (`dataKey`). La configuración es
 * fija: el editor solo añade/quita/reordena widgets de este catálogo.
 */

/** @typedef {'bar'|'hbar'|'donut'|'area'|'stat'} WidgetKind */

export const WIDGETS = [
  {
    type: 'pipeline-by-stage',
    title: 'Pipeline por etapa',
    kind: 'bar',
    dataKey: 'byStageAmount',
    unit: 'currency',
  },
  {
    type: 'count-by-stage',
    title: 'Oportunidades por etapa',
    kind: 'bar',
    dataKey: 'byStageCount',
  },
  {
    type: 'by-company',
    title: 'Negocios por empresa',
    kind: 'donut',
    dataKey: 'byCompany',
  },
  {
    type: 'by-owner',
    title: 'Oportunidades por responsable',
    kind: 'hbar',
    dataKey: 'byOwner',
  },
  {
    type: 'timeline',
    title: 'Valor por mes de cierre',
    kind: 'area',
    dataKey: 'timeline',
    unit: 'currency',
  },
  {
    type: 'total-pipeline',
    title: 'Pipeline total',
    kind: 'stat',
    dataKey: 'totalPipeline',
    unit: 'currency',
  },
  { type: 'total-count', title: 'Nº de oportunidades', kind: 'stat', dataKey: 'totalCount' },
  {
    type: 'won-count',
    title: 'Oportunidades ganadas',
    kind: 'stat',
    dataKey: 'wonCount',
  },
  {
    type: 'created-this-month',
    title: 'Creadas este mes',
    kind: 'stat',
    dataKey: 'createdThisMonthCount',
  },
  {
    type: 'value-this-month',
    title: 'Valor creado este mes',
    kind: 'stat',
    dataKey: 'valueThisMonth',
    unit: 'currency',
  },
];

const BY_TYPE = new Map(WIDGETS.map((w) => [w.type, w]));

/** Entrada del catálogo por tipo (o null si no existe). */
export function widgetDef(type) {
  return BY_TYPE.get(type) ?? null;
}

/** Tamaño por defecto (columnas × filas) según el tipo de widget. */
export function defaultSizeFor(type) {
  return widgetDef(type)?.kind === 'stat' ? { w: 1, h: 1 } : { w: 2, h: 2 };
}

/** Tamaños disponibles (rejilla de 4 columnas) para el control de tamaño. */
export const SIZE_PRESETS = [
  { w: 1, h: 1 },
  { w: 2, h: 1 },
  { w: 2, h: 2 },
  { w: 4, h: 2 },
  { w: 4, h: 3 },
];

/** Siguiente tamaño en el ciclo de presets (para el botón de redimensionar). */
export function nextSize(cur) {
  const i = SIZE_PRESETS.findIndex((s) => s.w === cur.w && s.h === cur.h);
  return SIZE_PRESETS[(i + 1) % SIZE_PRESETS.length];
}

/** ¿Es un tipo de widget conocido? */
export function isValidWidgetType(type) {
  return BY_TYPE.has(type);
}

/** Widgets por defecto de un panel recién creado. */
export const DEFAULT_WIDGETS = [
  'total-pipeline',
  'total-count',
  'created-this-month',
  'pipeline-by-stage',
  'by-company',
  'by-owner',
  'timeline',
];
