import { z } from 'zod';

/** Subdominios reservados que no se pueden usar como slug de workspace. */
const RESERVED_SUBDOMAINS = new Set([
  'www',
  'app',
  'api',
  'admin',
  'auth',
  'login',
  'signup',
  'welcome',
  'onboarding',
  'settings',
  'static',
  'assets',
  'mail',
  'help',
  'support',
  'status',
]);

/** Tamaño máximo de una imagen embebida como data URL (~300 KB en base64). */
const MAX_IMAGE_DATA_URL_LEN = 400_000;

/**
 * Origen de imagen para logoUrl/avatarUrl: data URL (subida y reescalada en
 * cliente) o URL http(s) (p. ej. la foto de perfil que devuelve Google). Cadena
 * vacía = sin imagen.
 */
const imageDataUrl = z
  .string()
  .trim()
  .max(MAX_IMAGE_DATA_URL_LEN, { error: 'La imagen es demasiado grande (máx. ~300 KB)' })
  .refine(
    (v) => v === '' || /^data:image\/(png|jpeg|webp|gif);base64,/.test(v) || /^https?:\/\//.test(v),
    { error: 'Formato de imagen no válido' },
  )
  .optional();

/** Subdominio: 3–30 chars, minúsculas/números/guiones, sin guion al inicio/fin. */
export const subdomain = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, { error: 'El subdominio debe tener al menos 3 caracteres' })
  .max(30, { error: 'El subdominio es demasiado largo' })
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, {
    error: 'Solo minúsculas, números y guiones (sin empezar ni acabar en guion)',
  })
  .refine((v) => !RESERVED_SUBDOMAINS.has(v), { error: 'Ese subdominio está reservado' });

/** Paso 1 — Crear workspace. */
export const workspaceStepSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: 'Ponle un nombre a tu espacio de trabajo' })
    .max(80, { error: 'El nombre es demasiado largo' }),
  subdomain,
  logoUrl: imageDataUrl,
});

/** Paso 2 — Tu perfil. */
export const profileStepSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, { error: 'Introduce tu nombre' })
    .max(80, { error: 'El nombre es demasiado largo' }),
  lastName: z.string().trim().max(80, { error: 'El apellido es demasiado largo' }).default(''),
  jobTitle: z.string().trim().max(120, { error: 'El puesto es demasiado largo' }).default(''),
  avatarUrl: imageDataUrl,
});

/** Paso 3 — Invitar equipo (hasta 3 emails; los vacíos se descartan antes). */
export const inviteStepSchema = z.object({
  emails: z
    .array(z.email({ error: 'Email no válido' }).trim().toLowerCase())
    .max(3, { error: 'Puedes invitar hasta 3 personas' })
    .default([]),
});
