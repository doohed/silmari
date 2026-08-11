import { connectToDatabase } from '@/lib/db/connect';
import { assertTenant } from '@/lib/services/tenant';
import { can } from '@/lib/auth/permissions';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors/domain-errors';
import { getObjectById } from '@/lib/metadata/object-service';
import { createRecord, updateRecord, listRecords } from '@/lib/records/service';
import { normalizeLeadPayload, normalizeKey } from '@/lib/leads/normalize-payload';
import { canBeDedupeKey, matchesDedupeKey } from '@/lib/leads/dedupe';
import { getFieldType } from '@/lib/field-types';
import { logger } from '@/lib/utils/logger';
import LeadIntake from '@/models/LeadIntake';

const MAX_LOG = 20;

/** DTO de una configuración de entrada para la UI. */
function toIntakeDTO(i) {
  return {
    id: String(i._id),
    name: i.name,
    provider: i.provider,
    formId: i.formId ?? '',
    objectMetadataId: String(i.objectMetadataId),
    mappings: (i.mappings ?? []).map((m) => ({ source: m.source, fieldName: m.fieldName })),
    dedupeFieldName: i.dedupeFieldName ?? null,
    isActive: i.isActive,
    stats: {
      received: i.stats?.received ?? 0,
      created: i.stats?.created ?? 0,
      updated: i.stats?.updated ?? 0,
      failed: i.stats?.failed ?? 0,
    },
    lastReceivedAt: i.lastReceivedAt ?? null,
    log: (i.log ?? [])
      .slice()
      .reverse()
      .map((l) => ({
        id: String(l._id),
        at: l.at,
        ok: l.ok,
        action: l.action,
        leadId: l.leadId ?? null,
        recordId: l.recordId ? String(l.recordId) : null,
        message: l.message ?? '',
      })),
  };
}

/**
 * Valida el objeto destino, el mapeo y el campo de deduplicación contra la
 * metadata real (nunca se confía en lo que manda el cliente).
 * @returns {Promise<{ object: object, mappings: Array<{source: string, fieldName: string}>, dedupeFieldName: string|null }>}
 */
async function validateAgainstMetadata(ctx, { objectMetadataId, mappings, dedupeFieldName }) {
  const object = await getObjectById(ctx, objectMetadataId); // lanza NotFoundError
  const byName = new Map(object.fields.map((f) => [f.name, f]));

  const clean = [];
  const seen = new Set();
  for (const m of mappings ?? []) {
    const source = normalizeKey(m?.source);
    const fieldName = String(m?.fieldName ?? '');
    if (!source || !fieldName) continue;
    const field = byName.get(fieldName);
    if (!field) {
      throw new ValidationError(`El campo "${fieldName}" no existe en ${object.labelPlural}`, {
        fieldErrors: { mappings: [`Campo desconocido: ${fieldName}`] },
      });
    }
    if (seen.has(source)) {
      throw new ValidationError(`La pregunta "${source}" está mapeada dos veces`, {
        fieldErrors: { mappings: [`Pregunta duplicada: ${source}`] },
      });
    }
    seen.add(source);
    clean.push({ source, fieldName });
  }

  if (clean.length === 0) {
    throw new ValidationError('Añade al menos una correspondencia de campo', {
      fieldErrors: { mappings: ['Añade al menos una correspondencia'] },
    });
  }

  let dedupe = dedupeFieldName || null;
  if (dedupe) {
    const field = byName.get(dedupe);
    if (!field) {
      throw new ValidationError(`El campo clave "${dedupe}" no existe`, {
        fieldErrors: { dedupeFieldName: ['Campo desconocido'] },
      });
    }
    // Solo valen los campos comparables de forma exacta; si no, la ingesta
    // fallaría (o deduplicaría mal) en caliente. Mejor bloquearlo al configurar.
    if (!canBeDedupeKey(field)) {
      throw new ValidationError(`El campo "${field.label}" no sirve como clave de duplicados`, {
        fieldErrors: { dedupeFieldName: ['Este tipo de campo no admite comparación exacta'] },
      });
    }
  }

  return { object, mappings: clean, dedupeFieldName: dedupe };
}

/** Lista las configuraciones de entrada del workspace. */
export async function listLeadIntakes(ctx) {
  assertTenant(ctx);
  if (!can(ctx, 'leadIntakes:manage')) {
    throw new ForbiddenError('No puedes gestionar la entrada de leads');
  }
  await connectToDatabase();
  const items = await LeadIntake.find({ workspaceId: ctx.workspaceId }).sort({ createdAt: -1 });
  return items.map(toIntakeDTO);
}

/**
 * Crea una configuración de entrada.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ name: string, formId?: string, objectMetadataId: string, mappings: Array, dedupeFieldName?: string|null }} input
 */
export async function createLeadIntake(ctx, input) {
  assertTenant(ctx);
  if (!can(ctx, 'leadIntakes:manage')) {
    throw new ForbiddenError('No puedes gestionar la entrada de leads');
  }
  const name = String(input?.name ?? '').trim();
  if (!name) {
    throw new ValidationError('Pon un nombre a la configuración', {
      fieldErrors: { name: ['El nombre es obligatorio'] },
    });
  }
  const { mappings, dedupeFieldName } = await validateAgainstMetadata(ctx, input);

  await connectToDatabase();
  try {
    const doc = await LeadIntake.create({
      workspaceId: ctx.workspaceId,
      name,
      provider: 'META',
      formId: String(input?.formId ?? '').trim(),
      objectMetadataId: input.objectMetadataId,
      mappings,
      dedupeFieldName,
      isActive: input?.isActive !== false,
    });
    return toIntakeDTO(doc);
  } catch (err) {
    if (err?.code === 11000) {
      throw new ConflictError('Ya hay una configuración para ese formulario', {
        fieldErrors: { formId: ['Ya existe una configuración con este ID de formulario'] },
      });
    }
    throw err;
  }
}

/** Actualiza una configuración de entrada. */
export async function updateLeadIntake(ctx, id, input) {
  assertTenant(ctx);
  if (!can(ctx, 'leadIntakes:manage')) {
    throw new ForbiddenError('No puedes gestionar la entrada de leads');
  }
  await connectToDatabase();
  const doc = await LeadIntake.findOne({ _id: id, workspaceId: ctx.workspaceId });
  if (!doc) throw new NotFoundError('Configuración no encontrada');

  if (input?.name !== undefined) {
    const name = String(input.name).trim();
    if (!name) {
      throw new ValidationError('Pon un nombre a la configuración', {
        fieldErrors: { name: ['El nombre es obligatorio'] },
      });
    }
    doc.name = name;
  }
  if (input?.isActive !== undefined) doc.isActive = Boolean(input.isActive);
  if (input?.formId !== undefined) doc.formId = String(input.formId).trim();

  if (input?.mappings !== undefined || input?.objectMetadataId !== undefined) {
    const { mappings, dedupeFieldName } = await validateAgainstMetadata(ctx, {
      objectMetadataId: input.objectMetadataId ?? String(doc.objectMetadataId),
      mappings: input.mappings ?? doc.mappings,
      dedupeFieldName:
        input.dedupeFieldName !== undefined ? input.dedupeFieldName : doc.dedupeFieldName,
    });
    doc.objectMetadataId = input.objectMetadataId ?? doc.objectMetadataId;
    doc.mappings = mappings;
    doc.dedupeFieldName = dedupeFieldName;
  } else if (input?.dedupeFieldName !== undefined) {
    const { dedupeFieldName } = await validateAgainstMetadata(ctx, {
      objectMetadataId: String(doc.objectMetadataId),
      mappings: doc.mappings,
      dedupeFieldName: input.dedupeFieldName,
    });
    doc.dedupeFieldName = dedupeFieldName;
  }

  try {
    await doc.save();
  } catch (err) {
    if (err?.code === 11000) {
      throw new ConflictError('Ya hay una configuración para ese formulario', {
        fieldErrors: { formId: ['Ya existe una configuración con este ID de formulario'] },
      });
    }
    throw err;
  }
  return toIntakeDTO(doc);
}

/** Borra una configuración de entrada. */
export async function deleteLeadIntake(ctx, id) {
  assertTenant(ctx);
  if (!can(ctx, 'leadIntakes:manage')) {
    throw new ForbiddenError('No puedes gestionar la entrada de leads');
  }
  await connectToDatabase();
  const doc = await LeadIntake.findOne({ _id: id, workspaceId: ctx.workspaceId });
  if (!doc) throw new NotFoundError('Configuración no encontrada');
  await doc.deleteOne();
}

/**
 * Adapta el valor entrante al campo destino. Un formulario de Meta manda texto
 * plano, así que los tipos compuestos del CRM necesitan traducción: "Ana Ruiz"
 * → `{ firstName, lastName }`, un email suelto → array de EMAILS. Para un
 * SELECT aceptamos tanto el `value` de la opción como su etiqueta visible. El
 * resto de la coerción (fechas, números, booleanos) la hace la validación del
 * registro.
 */
function coerceValue(field, value) {
  if (value === null || value === undefined || value === '') return null;
  const asArray = () => (Array.isArray(value) ? value : [value]);

  switch (field.type) {
    case 'FULL_NAME': {
      if (typeof value === 'object' && !Array.isArray(value)) return value;
      const parts = String(value).trim().split(/\s+/);
      return { firstName: parts.shift() ?? '', lastName: parts.join(' ') };
    }
    case 'EMAILS':
      return asArray()
        .map((v) => String(v).trim().toLowerCase())
        .filter(Boolean);
    case 'PHONES':
      return asArray()
        .map((v) => String(v).trim())
        .filter(Boolean);
    case 'LINKS':
      return asArray()
        .map((v) => (typeof v === 'object' ? v : { url: String(v).trim(), label: '' }))
        .filter((l) => l.url);
    case 'SELECT':
    case 'MULTI_SELECT': {
      const options = field.options ?? [];
      const match = (v) => {
        const key = normalizeKey(v);
        const opt = options.find(
          (o) => normalizeKey(o.value) === key || normalizeKey(o.label) === key,
        );
        return opt ? opt.value : v;
      };
      return field.type === 'MULTI_SELECT' ? asArray().map(match) : match(value);
    }
    default:
      return Array.isArray(value) ? value.join(', ') : value;
  }
}

/**
 * Busca un registro existente por el campo clave. El operador `eq` no existe en
 * todos los tipos (EMAILS solo tiene `contains`, que además es una subcadena),
 * así que se traen unos pocos candidatos y se confirma la igualdad en memoria.
 * @returns {Promise<string|null>} id del registro existente, o null
 */
async function findDuplicate(ctx, { object, field, value }) {
  const needle = Array.isArray(value) ? value[0] : value;
  if (needle === null || needle === undefined || needle === '') return null;

  const ops = getFieldType(field.type).filterOperators;
  const operator = ops.includes('eq') ? 'eq' : ops.includes('contains') ? 'contains' : null;
  if (!operator) return null;

  const { records } = await listRecords(ctx, {
    objectSlug: object.slug,
    filters: [{ fieldName: field.name, operator, value: needle }],
    limit: 5,
  });
  const hit = records.find((r) => matchesDedupeKey(r.data?.[field.name], needle));
  return hit?.id ?? null;
}

/** Añade una entrada al log circular y persiste stats. */
async function record(intake, entry, statKey) {
  intake.log.push(entry);
  if (intake.log.length > MAX_LOG) intake.log = intake.log.slice(-MAX_LOG);
  intake.stats.received += 1;
  intake.stats[statKey] += 1;
  intake.lastReceivedAt = new Date();
  await intake.save().catch((err) => logger.error('No se pudo guardar el log de ingesta', err));
}

/**
 * Ingesta un lead entrante: localiza la configuración por `form_id`, traduce las
 * respuestas a campos del CRM y crea (o actualiza, si hay campo clave) el registro.
 *
 * No exige `leadIntakes:manage`: la llama la API pública con el scope
 * `records:write` de una API key, cuyo `ctx` es de rol MEMBER.
 *
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {any} payload Cuerpo recibido de Zapier/Make/Meta.
 * @returns {Promise<{ action: 'created'|'updated', recordId: string, intakeId: string, mapped: string[], ignored: string[] }>}
 */
export async function ingestLead(ctx, payload) {
  assertTenant(ctx);
  const lead = normalizeLeadPayload(payload);
  await connectToDatabase();

  // Configuración del formulario concreto; si no hay, la comodín (formId '').
  const intake =
    (lead.formId &&
      (await LeadIntake.findOne({
        workspaceId: ctx.workspaceId,
        provider: 'META',
        formId: lead.formId,
        isActive: true,
      }))) ||
    (await LeadIntake.findOne({
      workspaceId: ctx.workspaceId,
      provider: 'META',
      formId: '',
      isActive: true,
    }));

  if (!intake) {
    throw new NotFoundError(
      lead.formId
        ? `No hay ninguna configuración de entrada activa para el formulario ${lead.formId}`
        : 'No hay ninguna configuración de entrada activa',
    );
  }

  const object = await getObjectById(ctx, String(intake.objectMetadataId));
  const byName = new Map(object.fields.map((f) => [f.name, f]));

  const data = {};
  const mapped = [];
  for (const m of intake.mappings) {
    if (!(m.source in lead.fields)) continue;
    const field = byName.get(m.fieldName);
    if (!field) continue; // el campo se borró después de configurar el mapeo
    const value = coerceValue(field, lead.fields[m.source]);
    if (value === null) continue;
    data[m.fieldName] = value;
    mapped.push(m.source);
  }
  const ignored = Object.keys(lead.fields).filter((k) => !mapped.includes(k));

  if (mapped.length === 0) {
    await record(
      intake,
      {
        ok: false,
        action: 'error',
        leadId: lead.leadId,
        message: `Ninguna pregunta del lead coincide con el mapeo (recibidas: ${
          ignored.join(', ') || 'ninguna'
        })`,
      },
      'failed',
    );
    throw new ValidationError(
      'El lead no trae ninguna de las preguntas mapeadas en esta configuración',
    );
  }

  try {
    // Con campo clave: si ya existe un registro con ese valor, se actualiza.
    let existingId = null;
    const dedupeField = intake.dedupeFieldName ? byName.get(intake.dedupeFieldName) : null;
    if (dedupeField && data[dedupeField.name] != null) {
      existingId = await findDuplicate(ctx, {
        object,
        field: dedupeField,
        value: data[dedupeField.name],
      });
    }

    const result = existingId
      ? await updateRecord(ctx, { objectSlug: object.slug, recordId: existingId, data })
      : await createRecord(ctx, { objectSlug: object.slug, data, source: 'API' });

    const action = existingId ? 'updated' : 'created';
    await record(
      intake,
      {
        ok: true,
        action,
        leadId: lead.leadId,
        recordId: result.id,
        message: ignored.length ? `Sin mapear: ${ignored.join(', ')}` : '',
      },
      action,
    );

    return {
      action,
      recordId: result.id,
      intakeId: String(intake._id),
      mapped,
      ignored,
    };
  } catch (err) {
    await record(
      intake,
      {
        ok: false,
        action: 'error',
        leadId: lead.leadId,
        message: String(err?.message ?? err).slice(0, 300),
      },
      'failed',
    );
    throw err;
  }
}
