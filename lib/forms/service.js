import { randomBytes } from 'node:crypto';
import { connectToDatabase } from '@/lib/db/connect';
import { assertTenant } from '@/lib/services/tenant';
import { can } from '@/lib/auth/permissions';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors/domain-errors';
import { getObjectById } from '@/lib/metadata/object-service';
import { isWritableField } from '@/lib/field-types';
import { applyMappedValues } from '@/lib/intake/mapping';
import { isSafeRedirectUrl, normalizeRedirectUrl } from '@/lib/forms/redirect-url';
import { slugify } from '@/lib/utils/slugify';
import WebForm from '@/models/WebForm';

/** DTO de administración (Ajustes). */
function toFormDTO(f) {
  return {
    id: String(f._id),
    name: f.name,
    slug: f.slug,
    objectMetadataId: String(f.objectMetadataId),
    fields: (f.fields ?? []).map((x) => ({
      fieldName: x.fieldName,
      label: x.label,
      required: x.required,
      placeholder: x.placeholder ?? '',
    })),
    dedupeFieldName: f.dedupeFieldName ?? null,
    submitLabel: f.submitLabel,
    successMessage: f.successMessage,
    redirectUrl: f.redirectUrl ?? null,
    isActive: f.isActive,
    stats: {
      submissions: f.stats?.submissions ?? 0,
      created: f.stats?.created ?? 0,
      updated: f.stats?.updated ?? 0,
    },
  };
}

/** Contexto de sistema para operar en nombre de un formulario público. */
function formCtx(form) {
  return {
    workspaceId: String(form.workspaceId),
    userId: `form:${form._id}`,
    role: 'MEMBER',
    actorName: form.name,
  };
}

/** Slug único global (base por nombre + sufijo aleatorio). */
async function uniqueSlug(name) {
  const base = slugify(name) || 'formulario';
  for (let i = 0; i < 5; i += 1) {
    const slug = `${base}-${randomBytes(3).toString('hex')}`;
    if (!(await WebForm.findOne({ slug }).select('_id').lean())) return slug;
  }
  return `${base}-${randomBytes(6).toString('hex')}`;
}

/**
 * Valida y normaliza la URL de redirección. Solo http(s): un `javascript:` aquí
 * se ejecutaría en nuestro origen, en la página pública del formulario.
 * @param {unknown} raw
 * @returns {string | null}
 */
function checkedRedirectUrl(raw) {
  const url = normalizeRedirectUrl(raw);
  if (url && !isSafeRedirectUrl(url)) {
    throw new ValidationError('La URL de redirección debe empezar por http:// o https://', {
      fieldErrors: { redirectUrl: ['Usa una URL http:// o https://'] },
    });
  }
  return url;
}

/**
 * Resuelve el objeto y valida los campos del formulario contra su metadata
 * (nunca se confía en el cliente): cada campo debe existir y ser escribible.
 */
async function resolveAndValidate(ctx, { objectMetadataId, fields, dedupeFieldName }) {
  if (!objectMetadataId) throw new ValidationError('Elige un objeto destino');
  const object = await getObjectById(ctx, String(objectMetadataId)); // lanza NotFoundError
  const byName = new Map(object.fields.map((f) => [f.name, f]));
  const normFields = (fields ?? []).map((f) => {
    const meta = byName.get(f.fieldName);
    if (!meta) throw new ValidationError(`Campo desconocido: ${f.fieldName}`);
    if (!isWritableField(meta))
      throw new ValidationError(`El campo "${f.fieldName}" no es editable`);
    return {
      fieldName: f.fieldName,
      label: f.label || meta.label,
      required: Boolean(f.required),
      placeholder: f.placeholder || '',
    };
  });
  if (normFields.length === 0) throw new ValidationError('Añade al menos un campo al formulario');
  if (dedupeFieldName && !byName.has(dedupeFieldName)) {
    throw new ValidationError('El campo de deduplicación no existe');
  }
  return { object, normFields };
}

/** Crea un formulario. */
export async function createForm(ctx, input) {
  assertTenant(ctx);
  if (!can(ctx, 'forms:manage')) throw new ForbiddenError('No puedes gestionar formularios');
  if (!input?.name?.trim()) {
    throw new ValidationError('El formulario necesita un nombre', {
      fieldErrors: { name: ['Escribe un nombre'] },
    });
  }
  const { normFields } = await resolveAndValidate(ctx, input);
  await connectToDatabase();
  const doc = await WebForm.create({
    workspaceId: ctx.workspaceId,
    name: input.name.trim(),
    slug: await uniqueSlug(input.name),
    objectMetadataId: input.objectMetadataId,
    fields: normFields,
    dedupeFieldName: input.dedupeFieldName || null,
    submitLabel: input.submitLabel?.trim() || 'Enviar',
    successMessage: input.successMessage?.trim() || '¡Gracias! Hemos recibido tu mensaje.',
    redirectUrl: checkedRedirectUrl(input.redirectUrl),
    isActive: input.isActive ?? true,
  });
  return toFormDTO(doc);
}

/** Lista los formularios del workspace. */
export async function listForms(ctx) {
  assertTenant(ctx);
  if (!can(ctx, 'forms:manage')) throw new ForbiddenError('No puedes gestionar formularios');
  await connectToDatabase();
  const items = await WebForm.find({ workspaceId: ctx.workspaceId }).sort({ createdAt: -1 });
  return items.map(toFormDTO);
}

async function loadForm(ctx, id) {
  const f = await WebForm.findOne({ _id: id, workspaceId: ctx.workspaceId });
  if (!f) throw new NotFoundError('Formulario no encontrado');
  return f;
}

/** Actualiza un formulario. */
export async function updateForm(ctx, id, patch) {
  assertTenant(ctx);
  if (!can(ctx, 'forms:manage')) throw new ForbiddenError('No puedes gestionar formularios');
  await connectToDatabase();
  const form = await loadForm(ctx, id);
  if (patch.fields !== undefined || patch.objectMetadataId !== undefined) {
    const { normFields } = await resolveAndValidate(ctx, {
      objectMetadataId: patch.objectMetadataId ?? form.objectMetadataId,
      fields: patch.fields ?? form.fields,
      dedupeFieldName: patch.dedupeFieldName ?? form.dedupeFieldName,
    });
    form.fields = normFields;
    if (patch.objectMetadataId !== undefined) form.objectMetadataId = patch.objectMetadataId;
  }
  if (patch.name !== undefined) {
    if (!patch.name.trim()) throw new ValidationError('El nombre no puede quedar vacío');
    form.name = patch.name.trim();
  }
  if (patch.dedupeFieldName !== undefined) form.dedupeFieldName = patch.dedupeFieldName || null;
  if (patch.submitLabel !== undefined) form.submitLabel = patch.submitLabel.trim() || 'Enviar';
  if (patch.successMessage !== undefined) form.successMessage = patch.successMessage;
  if (patch.redirectUrl !== undefined) form.redirectUrl = checkedRedirectUrl(patch.redirectUrl);
  if (patch.isActive !== undefined) form.isActive = patch.isActive;
  await form.save();
  return toFormDTO(form);
}

/** Activa/desactiva un formulario. */
export async function toggleForm(ctx, id) {
  assertTenant(ctx);
  if (!can(ctx, 'forms:manage')) throw new ForbiddenError('No puedes gestionar formularios');
  await connectToDatabase();
  const form = await loadForm(ctx, id);
  form.isActive = !form.isActive;
  await form.save();
  return toFormDTO(form);
}

/** Borra un formulario. */
export async function deleteForm(ctx, id) {
  assertTenant(ctx);
  if (!can(ctx, 'forms:manage')) throw new ForbiddenError('No puedes gestionar formularios');
  await connectToDatabase();
  const form = await loadForm(ctx, id);
  await form.deleteOne();
}

// --- Público (sin sesión) ---

/**
 * Esquema de render de un formulario activo por su slug. **Público**: no recibe
 * ctx y solo devuelve lo necesario para pintarlo (nada sensible).
 * @param {string} slug
 */
export async function getPublicForm(slug) {
  await connectToDatabase();
  const form = await WebForm.findOne({ slug, isActive: true });
  if (!form) throw new NotFoundError('Formulario no encontrado');
  const object = await getObjectById(formCtx(form), String(form.objectMetadataId));
  const byName = new Map(object.fields.map((f) => [f.name, f]));
  return {
    slug: form.slug,
    name: form.name,
    submitLabel: form.submitLabel,
    successMessage: form.successMessage,
    // Los formularios guardados antes de que existiera la validación pueden
    // llevar cualquier cosa aquí: no se sirve lo que no se puede navegar.
    redirectUrl: isSafeRedirectUrl(form.redirectUrl) ? form.redirectUrl : null,
    fields: form.fields.map((f) => ({
      fieldName: f.fieldName,
      label: f.label,
      required: f.required,
      placeholder: f.placeholder ?? '',
      type: byName.get(f.fieldName)?.type ?? 'TEXT',
    })),
  };
}

/**
 * Procesa un envío público. Rechaza spam por honeypot, valida requeridos y
 * delega en el núcleo compartido (coacción + dedup + crear/actualizar) con
 * origen `FORM`. El `workspaceId` sale del formulario, nunca del payload.
 * @param {string} slug
 * @param {Record<string, any>} values
 * @param {{ honeypot?: string }} [opts]
 * @returns {Promise<{ ok: boolean, action: 'created'|'updated'|null }>}
 */
export async function submitPublicForm(slug, values, { honeypot } = {}) {
  // Trampa anti-spam: si el campo oculto viene relleno, aceptamos en silencio
  // sin crear nada (no le damos pistas al bot).
  if (honeypot) return { ok: true, action: null };

  await connectToDatabase();
  const form = await WebForm.findOne({ slug, isActive: true });
  if (!form) throw new NotFoundError('Formulario no encontrado');
  const ctx = formCtx(form);
  const object = await getObjectById(ctx, String(form.objectMetadataId));

  for (const f of form.fields) {
    if (f.required) {
      const v = values?.[f.fieldName];
      if (v == null || v === '') {
        throw new ValidationError(`Falta el campo obligatorio: ${f.label || f.fieldName}`);
      }
    }
  }

  const mappings = form.fields.map((f) => ({ source: f.fieldName, fieldName: f.fieldName }));
  const result = await applyMappedValues(ctx, {
    object,
    mappings,
    values: values ?? {},
    dedupeFieldName: form.dedupeFieldName,
    source: 'FORM',
  });

  form.stats.submissions += 1;
  if (result.action === 'created') form.stats.created += 1;
  if (result.action === 'updated') form.stats.updated += 1;
  await form.save().catch(() => {});

  return { ok: true, action: result.action };
}
