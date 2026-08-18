/**
 * Datos del responsable del tratamiento y de la entidad que presta el servicio.
 *
 * **Rellena esto antes de publicar.** Los textos legales los interpolan; mientras
 * queden marcadores, las páginas muestran un aviso de borrador bien visible, para
 * que no se publique sin querer un aviso legal a medias.
 *
 * Módulo puro: lo consumen tanto las páginas como el test que comprueba que no
 * queden marcadores en producción.
 */

const PLACEHOLDER = /^\[\[.*\]\]$/;

export const LEGAL = {
  /** Razón social completa. */
  companyName: '[[RAZÓN SOCIAL]]',
  /** CIF/NIF. */
  taxId: '[[CIF]]',
  /** Domicilio social completo. */
  address: '[[DIRECCIÓN POSTAL COMPLETA]]',
  /** Datos registrales, si la sociedad está inscrita. */
  registryInfo: '[[DATOS REGISTRALES]]',
  /** Email de contacto general. */
  contactEmail: '[[CONTACTO@TUDOMINIO.COM]]',
  /** Email para ejercer derechos RGPD. Puede ser el mismo que el de contacto. */
  privacyEmail: '[[PRIVACIDAD@TUDOMINIO.COM]]',
  /** Fecha de la última revisión de los textos. */
  lastUpdated: '[[FECHA]]',
};

/** ¿Queda algún dato sin rellenar? */
export function legalIsDraft() {
  return Object.values(LEGAL).some((value) => PLACEHOLDER.test(String(value)));
}

/**
 * Encargados del tratamiento a los que se comunican datos. Cada uno debe tener
 * su contrato de encargo firmado antes de entrar en producción.
 *
 * Esta lista **no es decorativa**: es el núcleo del registro de actividades de
 * tratamiento y lo primero que pide un cliente en una auditoría. Si añades una
 * integración que salga fuera, añádela aquí en el mismo commit.
 */
export const SUBPROCESSORS = [
  {
    name: 'Proveedor de alojamiento',
    purpose: 'Servidores donde corre la aplicación y su base de datos',
    location: '[[PAÍS / REGIÓN]]',
  },
  {
    name: 'Resend',
    purpose: 'Envío del correo transaccional (recuperar contraseña, invitaciones)',
    location: 'EE. UU.',
  },
  {
    name: 'Stripe',
    purpose: 'Procesamiento de pagos y facturación',
    location: 'EE. UU. / Irlanda',
  },
  {
    name: 'Google / Microsoft',
    purpose: 'Inicio de sesión con cuenta corporativa (solo si el usuario lo elige)',
    location: 'EE. UU.',
  },
  {
    name: 'Meta, vía Zapier o Make',
    purpose: 'Entrada de leads desde formularios de Facebook e Instagram (solo si se activa)',
    location: 'EE. UU.',
  },
];

/**
 * Cookies que usa la aplicación. Auditadas contra el código, no inventadas.
 *
 * Todas son **estrictamente necesarias o de preferencia fijada por el propio
 * usuario**, y no hay ninguna analítica ni rastreador de terceros. Por eso no se
 * muestra banner de consentimiento: pedirlo para esto sería incorrecto y además
 * penaliza la conversión. **Si algún día añades analítica, esto cambia** y
 * tendrás que implementar consentimiento previo.
 */
export const COOKIES = [
  {
    name: 'silmari_session',
    purpose: 'Mantener la sesión iniciada',
    category: 'Estrictamente necesaria',
    duration: 'Hasta cerrar sesión o su caducidad',
  },
  {
    name: 'theme',
    purpose: 'Recordar el tema claro u oscuro elegido',
    category: 'Preferencia del usuario',
    duration: 'Persistente',
  },
  {
    name: 'locale',
    purpose: 'Recordar el idioma elegido',
    category: 'Preferencia del usuario',
    duration: 'Persistente',
  },
  {
    name: 'g_state / ms_state',
    purpose: 'Proteger el inicio de sesión con Google o Microsoft frente a CSRF',
    category: 'Estrictamente necesaria',
    duration: 'Minutos, solo durante el proceso',
  },
];
