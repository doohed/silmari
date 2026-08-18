import mongoose from 'mongoose';
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';
import { connectToDatabase } from '@/lib/db/connect';
import { assertTenant } from '@/lib/services/tenant';
import { hydrateRecords } from '@/lib/records/hydrate';
import { isValidWidgetType, DEFAULT_WIDGETS, defaultSizeFor } from '@/lib/dashboards/catalog';
import { NotFoundError, ValidationError } from '@/lib/errors/domain-errors';
import { randomBytes } from 'node:crypto';
import ObjectMetadata from '@/models/ObjectMetadata';
import FieldMetadata from '@/models/FieldMetadata';
import Record from '@/models/Record';
import Dashboard from '@/models/Dashboard';
import User from '@/models/User';

/** @typedef {import('@/lib/auth/permissions').Ctx} Ctx */

const MAX_RECORDS = 2000;
const MAX_NAME = 60;
const wid = () => randomBytes(6).toString('hex');

const clampW = (n) => Math.min(4, Math.max(1, Math.round(Number(n) || 0)));
const clampH = (n) => Math.min(3, Math.max(1, Math.round(Number(n) || 0)));

/** Normaliza y valida el nombre de un panel. Lanza `ValidationError` si es inválido. */
function cleanName(name) {
  const n = String(name ?? '').trim();
  if (!n) {
    throw new ValidationError('El nombre es obligatorio', {
      fieldErrors: { name: ['Escribe un nombre'] },
    });
  }
  if (n.length > MAX_NAME) {
    throw new ValidationError('Nombre demasiado largo', {
      fieldErrors: { name: [`Máximo ${MAX_NAME} caracteres`] },
    });
  }
  return n;
}

/** Autor del panel: null para claves de API, el usuario en sesión en otro caso. */
function authorId(ctx) {
  return String(ctx.userId).startsWith('apikey:') ? null : ctx.userId;
}

/** DTO del panel para el cliente. */
function toDashboardDTO(d, creator) {
  return {
    id: String(d._id),
    name: d.name,
    position: d.position ?? null,
    createdBy: creator
      ? { name: `${creator.firstName} ${creator.lastName}`.trim(), avatarUrl: creator.avatarUrl }
      : { name: 'Sistema', avatarUrl: null },
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
    updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : null,
    widgets: (d.widgets ?? []).map((w) => {
      const def = defaultSizeFor(w.type);
      return { id: w.id, type: w.type, w: clampW(w.w ?? def.w), h: clampH(w.h ?? def.h) };
    }),
  };
}

/** Mapa id→usuario para resolver el «creado por» de una lista de paneles. */
async function creatorsById(docs) {
  const ids = [
    ...new Set(
      docs
        .map((d) => d.createdBy)
        .filter(Boolean)
        .map(String),
    ),
  ];
  if (ids.length === 0) return new Map();
  const users = await User.find({ _id: { $in: ids } })
    .select('firstName lastName avatarUrl')
    .lean();
  return new Map(users.map((u) => [String(u._id), u]));
}

/** Busca un panel del workspace por id (lanza `NotFoundError` si no existe). */
async function findDashboardOrThrow(ctx, id) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new NotFoundError('Panel no encontrado');
  const d = await Dashboard.findOne({ _id: id, workspaceId: ctx.workspaceId, deletedAt: null });
  if (!d) throw new NotFoundError('Panel no encontrado');
  return d;
}

/** Última clave de orden del workspace (para añadir al final), o null si no hay. */
async function lastPosition(ctx) {
  const last = await Dashboard.findOne({
    workspaceId: ctx.workspaceId,
    deletedAt: null,
    position: { $ne: null },
  })
    .sort({ position: -1 })
    .select('position')
    .lean();
  return last?.position ?? null;
}

/**
 * Asigna claves de orden a los paneles que no la tengan (migración perezosa de
 * paneles antiguos), respetando su orden actual. Muta `docs` en memoria.
 */
async function backfillPositions(docs) {
  if (docs.every((d) => d.position)) return docs;
  const keys = generateNKeysBetween(null, null, docs.length);
  await Promise.all(
    docs.map((d, i) => {
      d.position = keys[i];
      return Dashboard.updateOne({ _id: d._id }, { $set: { position: keys[i] } });
    }),
  );
  return docs;
}

/**
 * Devuelve los paneles del workspace ordenados por su clave de orden manual
 * (`position`), creando uno por defecto si todavía no hay ninguno. Siempre
 * devuelve al menos un panel.
 * @param {Ctx} ctx
 * @returns {Promise<Array<{ id: string, name: string, position: string|null, widgets: Array<object> }>>}
 */
export async function listDashboards(ctx) {
  assertTenant(ctx);
  await connectToDatabase();
  // `position` primero; `createdAt`/`_id` desempatan y dan un orden estable a los
  // paneles antiguos (sin `position`) antes de rellenarles la clave.
  let docs = await Dashboard.find({ workspaceId: ctx.workspaceId, deletedAt: null }).sort({
    position: 1,
    createdAt: 1,
    _id: 1,
  });
  if (docs.length === 0) {
    const d = await Dashboard.create({
      workspaceId: ctx.workspaceId,
      name: 'Panel de oportunidades',
      widgets: DEFAULT_WIDGETS.map((type) => ({ id: wid(), type, ...defaultSizeFor(type) })),
      position: generateKeyBetween(null, null),
      createdBy: authorId(ctx),
    });
    docs = [d];
  } else {
    await backfillPositions(docs);
  }
  const creators = await creatorsById(docs);
  return docs.map((d) => toDashboardDTO(d, creators.get(String(d.createdBy))));
}

/**
 * Devuelve un panel concreto del workspace por id.
 * @param {Ctx} ctx
 * @param {{ id: string }} input
 */
export async function getDashboard(ctx, { id }) {
  assertTenant(ctx);
  await connectToDatabase();
  const d = await findDashboardOrThrow(ctx, id);
  const creators = await creatorsById([d]);
  return toDashboardDTO(d, creators.get(String(d.createdBy)));
}

/**
 * Crea un panel nuevo con los widgets por defecto.
 * @param {Ctx} ctx
 * @param {{ name: string }} input
 */
export async function createDashboard(ctx, { name }) {
  assertTenant(ctx);
  await connectToDatabase();
  const d = await Dashboard.create({
    workspaceId: ctx.workspaceId,
    name: cleanName(name),
    widgets: DEFAULT_WIDGETS.map((type) => ({ id: wid(), type, ...defaultSizeFor(type) })),
    position: generateKeyBetween(await lastPosition(ctx), null),
    createdBy: authorId(ctx),
  });
  const creators = await creatorsById([d]);
  return toDashboardDTO(d, creators.get(String(d.createdBy)));
}

/**
 * Cambia la clave de orden de un panel (arrastrar y soltar). La clave la calcula
 * el cliente entre sus vecinos (fractional indexing); aquí se valida y persiste.
 * @param {Ctx} ctx
 * @param {{ id: string, position: string }} input
 */
export async function reorderDashboard(ctx, { id, position }) {
  assertTenant(ctx);
  await connectToDatabase();
  if (typeof position !== 'string' || position.length === 0) {
    throw new ValidationError('Posición inválida');
  }
  const d = await findDashboardOrThrow(ctx, id);
  d.position = position;
  await d.save();
  const creators = await creatorsById([d]);
  return toDashboardDTO(d, creators.get(String(d.createdBy)));
}

/**
 * Renombra un panel del workspace.
 * @param {Ctx} ctx
 * @param {{ id: string, name: string }} input
 */
export async function renameDashboard(ctx, { id, name }) {
  assertTenant(ctx);
  await connectToDatabase();
  const clean = cleanName(name);
  const d = await findDashboardOrThrow(ctx, id);
  d.name = clean;
  await d.save();
  return toDashboardDTO(d);
}

/**
 * Borra (soft delete) un panel. No permite borrar el último panel del workspace.
 * @param {Ctx} ctx
 * @param {{ id: string }} input
 */
export async function deleteDashboard(ctx, { id }) {
  assertTenant(ctx);
  await connectToDatabase();
  const count = await Dashboard.countDocuments({ workspaceId: ctx.workspaceId, deletedAt: null });
  if (count <= 1) {
    throw new ValidationError('No puedes borrar el último panel');
  }
  const d = await findDashboardOrThrow(ctx, id);
  d.deletedAt = new Date();
  await d.save();
  return { id: String(d._id) };
}

/**
 * Guarda la lista (orden + composición) de widgets de un panel. Valida los tipos
 * contra el catálogo; asigna id a los nuevos.
 * @param {Ctx} ctx
 * @param {{ id: string, widgets: Array<{ id?: string, type: string }> }} input
 */
export async function updateDashboardWidgets(ctx, { id, widgets }) {
  assertTenant(ctx);
  await connectToDatabase();
  const clean = (Array.isArray(widgets) ? widgets : [])
    .filter((w) => isValidWidgetType(w?.type))
    .map((w) => {
      const def = defaultSizeFor(w.type);
      return { id: w.id || wid(), type: w.type, w: clampW(w.w ?? def.w), h: clampH(w.h ?? def.h) };
    });

  const d = await findDashboardOrThrow(ctx, id);
  d.widgets = clean;
  await d.save();
  return toDashboardDTO(d);
}

/** Resuelve el objeto Oportunidad y sus campos. */
async function opportunityObject(ctx) {
  const object = await ObjectMetadata.findOne({
    workspaceId: ctx.workspaceId,
    nameSingular: 'opportunity',
    deletedAt: null,
  }).lean();
  if (!object) return null;
  const fields = await FieldMetadata.find({
    workspaceId: ctx.workspaceId,
    objectMetadataId: object._id,
    isActive: { $ne: false },
  }).lean();
  return { object, fields };
}

const monthLabel = (d) =>
  new Intl.DateTimeFormat('es-ES', { month: 'short', year: '2-digit' }).format(d);
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/**
 * Calcula todas las métricas de Oportunidades que consumen los widgets.
 * Un solo recorrido en memoria (suficiente para el volumen del CRM).
 * @param {Ctx} ctx
 */
export async function getOpportunityMetrics(ctx) {
  assertTenant(ctx);
  await connectToDatabase();

  const resolved = await opportunityObject(ctx);
  if (!resolved) return emptyMetrics();
  const { object, fields } = resolved;

  const raw = await Record.find({
    workspaceId: ctx.workspaceId,
    objectMetadataId: object._id,
    deletedAt: null,
  })
    .limit(MAX_RECORDS)
    .lean();
  const records = await hydrateRecords(ctx, { records: raw, fields });

  const stageField = fields.find((f) => f.name === 'stage');
  const stageOptions = [...(stageField?.options ?? [])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );
  const stageLabel = new Map(stageOptions.map((o) => [o.value, o.label]));

  const amountOf = (r) => Number(r.data?.amount?.amount ?? 0) || 0;

  // Por etapa (importe y conteo), respetando el orden de las opciones.
  const byStageAmount = stageOptions.map((o) => ({ label: o.label, value: 0 }));
  const byStageCount = stageOptions.map((o) => ({ label: o.label, value: 0 }));
  const stageIdx = new Map(stageOptions.map((o, i) => [o.value, i]));

  const companyCount = new Map();
  const ownerCount = new Map();
  const monthAmount = new Map(); // key -> { label, date, value }

  const now = new Date();
  const thisMonth = monthKey(now);
  let totalPipeline = 0;
  let wonCount = 0;
  let createdThisMonthCount = 0;
  let valueThisMonth = 0;

  for (const r of records) {
    const amt = amountOf(r);
    totalPipeline += amt;

    const stage = r.data?.stage;
    if (stageIdx.has(stage)) {
      byStageAmount[stageIdx.get(stage)].value += amt;
      byStageCount[stageIdx.get(stage)].value += 1;
    }
    if (stage === 'won') wonCount += 1;

    const company = r.relations?.company?.label ?? 'Sin empresa';
    companyCount.set(company, (companyCount.get(company) ?? 0) + 1);

    // El responsable es quien creó la oportunidad (campo "Creado por"); los
    // datos demo (origen SYSTEM) se agrupan como "Sistema".
    const cb = r.createdBy;
    const owner =
      cb?.userId && cb.source !== 'SYSTEM' && cb.source !== 'API' && cb.name ? cb.name : 'Sistema';
    ownerCount.set(owner, (ownerCount.get(owner) ?? 0) + 1);

    const close = r.data?.closeDate ? new Date(r.data.closeDate) : null;
    if (close && !Number.isNaN(close.getTime())) {
      const k = monthKey(close);
      const cur = monthAmount.get(k) ?? { label: monthLabel(close), date: close, value: 0 };
      cur.value += amt;
      monthAmount.set(k, cur);
    }

    const created = r.createdAt ? new Date(r.createdAt) : null;
    if (created && monthKey(created) === thisMonth) {
      createdThisMonthCount += 1;
      valueThisMonth += amt;
    }
  }

  const topN = (map, n = 7) => {
    const arr = [...map.entries()].map(([label, value]) => ({ label, value }));
    arr.sort((a, b) => b.value - a.value);
    if (arr.length <= n) return arr;
    const head = arr.slice(0, n);
    const rest = arr.slice(n).reduce((s, x) => s + x.value, 0);
    return [...head, { label: 'Otros', value: rest }];
  };

  const timeline = [...monthAmount.values()]
    .sort((a, b) => a.date - b.date)
    .slice(-12)
    .map((m) => ({ label: m.label, value: m.value }));

  return {
    byStageAmount,
    byStageCount,
    byCompany: topN(companyCount),
    byOwner: topN(ownerCount),
    timeline,
    totalPipeline,
    totalCount: records.length,
    wonCount,
    createdThisMonthCount,
    valueThisMonth,
  };
}

function emptyMetrics() {
  return {
    byStageAmount: [],
    byStageCount: [],
    byCompany: [],
    byOwner: [],
    timeline: [],
    totalPipeline: 0,
    totalCount: 0,
    wonCount: 0,
    createdThisMonthCount: 0,
    valueThisMonth: 0,
  };
}
