import { connectToDatabase } from '@/lib/db/connect';
import { assertTenant } from '@/lib/services/tenant';
import { can } from '@/lib/auth/permissions';
import { ForbiddenError, ValidationError } from '@/lib/errors/domain-errors';
import { encryptSecret, decryptSecret } from '@/lib/utils/crypto';
import Integration from '@/models/Integration';

function assertManage(ctx) {
  assertTenant(ctx);
  if (!can(ctx, 'integrations:manage')) {
    throw new ForbiddenError('No puedes gestionar integraciones');
  }
}

async function findConnection(ctx, kind) {
  await connectToDatabase();
  return Integration.findOne({ workspaceId: ctx.workspaceId, kind });
}

// --- Email (SMTP) ---

/** DTO redactado del email para la UI (nunca expone la contraseña). */
function emailDTO(doc) {
  if (!doc) return { connected: false };
  return {
    connected: true,
    isActive: doc.isActive,
    host: doc.config?.host ?? '',
    port: doc.config?.port ?? 587,
    secure: doc.config?.secure ?? false,
    user: doc.config?.user ?? '',
    fromName: doc.config?.fromName ?? '',
    fromEmail: doc.config?.fromEmail ?? '',
  };
}

/** Estado de la conexión de correo (para Ajustes). */
export async function getEmailConnection(ctx) {
  assertManage(ctx);
  return emailDTO(await findConnection(ctx, 'EMAIL_SMTP'));
}

/** Guarda (o actualiza) la conexión SMTP. La contraseña solo se cambia si viene. */
export async function saveEmailConnection(ctx, input) {
  assertManage(ctx);
  const host = input?.host?.trim();
  const user = input?.user?.trim();
  const fromEmail = input?.fromEmail?.trim() || user;
  if (!host) throw new ValidationError('Falta el servidor SMTP (host)');
  if (!user) throw new ValidationError('Falta el usuario');
  const port = Number(input?.port) || 587;

  await connectToDatabase();
  const existing = await findConnection(ctx, 'EMAIL_SMTP');
  const config = {
    host,
    port,
    secure: Boolean(input?.secure ?? port === 465),
    user,
    fromName: input?.fromName?.trim() || '',
    fromEmail,
  };

  if (existing) {
    existing.config = config;
    if (input?.password) existing.secret = encryptSecret(input.password);
    existing.isActive = input?.isActive ?? existing.isActive;
    await existing.save();
    return emailDTO(existing);
  }

  if (!input?.password) throw new ValidationError('Falta la contraseña');
  const doc = await Integration.create({
    workspaceId: ctx.workspaceId,
    kind: 'EMAIL_SMTP',
    config,
    secret: encryptSecret(input.password),
  });
  return emailDTO(doc);
}

/** Elimina la conexión de correo. */
export async function deleteEmailConnection(ctx) {
  assertManage(ctx);
  const doc = await findConnection(ctx, 'EMAIL_SMTP');
  if (doc) await doc.deleteOne();
}

/**
 * Config de envío de correo lista para usar (con la contraseña descifrada). La
 * usan los proveedores; **no** exige `integrations:manage` (la invoca el envío en
 * nombre de cualquier miembro), pero sí queda acotada por `workspaceId`.
 * @returns {Promise<null | { host, port, secure, auth:{user,pass}, from }>}
 */
export async function loadEmailConfig(ctx) {
  assertTenant(ctx);
  const doc = await findConnection(ctx, 'EMAIL_SMTP');
  if (!doc || !doc.isActive || !doc.secret) return null;
  const from = doc.config?.fromName
    ? `${doc.config.fromName} <${doc.config.fromEmail || doc.config.user}>`
    : doc.config?.fromEmail || doc.config?.user;
  return {
    host: doc.config.host,
    port: doc.config.port,
    secure: doc.config.secure,
    auth: { user: doc.config.user, pass: decryptSecret(doc.secret) },
    from,
  };
}

// --- WhatsApp (Cloud API) ---

function whatsappDTO(doc) {
  if (!doc) return { connected: false };
  return {
    connected: true,
    isActive: doc.isActive,
    phoneNumberId: doc.config?.phoneNumberId ?? '',
    businessId: doc.config?.businessId ?? '',
  };
}

/** Estado de la conexión de WhatsApp (para Ajustes). */
export async function getWhatsappConnection(ctx) {
  assertManage(ctx);
  return whatsappDTO(await findConnection(ctx, 'WHATSAPP'));
}

/** Guarda (o actualiza) la conexión de WhatsApp Cloud API. */
export async function saveWhatsappConnection(ctx, input) {
  assertManage(ctx);
  const phoneNumberId = input?.phoneNumberId?.trim();
  if (!phoneNumberId) throw new ValidationError('Falta el ID del número (phone_number_id)');

  await connectToDatabase();
  const existing = await findConnection(ctx, 'WHATSAPP');
  const config = { phoneNumberId, businessId: input?.businessId?.trim() || '' };

  if (existing) {
    existing.config = config;
    if (input?.accessToken) existing.secret = encryptSecret(input.accessToken);
    existing.isActive = input?.isActive ?? existing.isActive;
    await existing.save();
    return whatsappDTO(existing);
  }

  if (!input?.accessToken) throw new ValidationError('Falta el token de acceso');
  const doc = await Integration.create({
    workspaceId: ctx.workspaceId,
    kind: 'WHATSAPP',
    config,
    secret: encryptSecret(input.accessToken),
  });
  return whatsappDTO(doc);
}

/** Elimina la conexión de WhatsApp. */
export async function deleteWhatsappConnection(ctx) {
  assertManage(ctx);
  const doc = await findConnection(ctx, 'WHATSAPP');
  if (doc) await doc.deleteOne();
}

/**
 * Config de WhatsApp lista para usar (token descifrado). La usan los proveedores.
 * @returns {Promise<null | { phoneNumberId: string, accessToken: string }>}
 */
export async function loadWhatsappConfig(ctx) {
  assertTenant(ctx);
  const doc = await findConnection(ctx, 'WHATSAPP');
  if (!doc || !doc.isActive || !doc.secret) return null;
  return { phoneNumberId: doc.config.phoneNumberId, accessToken: decryptSecret(doc.secret) };
}
