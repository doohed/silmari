/**
 * Configuración derivada del entorno. Centralizada para no esparcir
 * `process.env` por el código y tener valores por defecto sensatos en dev.
 */

/** URL base de la app (para enlaces absolutos: invitaciones, callbacks OAuth). */
export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

/** Dominio de los subdominios de workspace (sufijo mostrado en el onboarding). */
export function appDomain() {
  return process.env.NEXT_PUBLIC_APP_DOMAIN || 'silmari.app';
}

/** Nombre de producto (marca), usado en pantallas públicas. */
export function appName() {
  return process.env.NEXT_PUBLIC_APP_NAME || 'Silmari';
}
