/**
 * Cabeceras de seguridad de la aplicación.
 *
 * Las estáticas (las que no dependen de la petición) se declaran en
 * `next.config.mjs`. La **CSP** se genera aquí porque necesita un `nonce`
 * distinto por respuesta, y eso solo se puede hacer en el proxy.
 *
 * Módulo puro para poder testearlo sin levantar el servidor.
 */

/** Cabeceras iguales en todas las respuestas. */
export const STATIC_SECURITY_HEADERS = [
  // Sin sniffing de tipo: un .txt subido no se ejecuta como script.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Redundante con `frame-ancestors` de la CSP, pero cubre navegadores viejos.
  { key: 'X-Frame-Options', value: 'DENY' },
  // No filtrar la ruta completa (que puede llevar ids) a terceros.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Nada de cámara, micro ni geolocalización: la app no los usa.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  // HSTS: dos años y subdominios. Solo tiene efecto sobre HTTPS, así que en
  // local (http) el navegador la ignora.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

/**
 * Construye la Content-Security-Policy.
 *
 * Decisiones que conviene entender antes de tocarla:
 *
 * - **`script-src` con nonce + `strict-dynamic`.** Next inyecta sus propios
 *   scripts en línea para el streaming de RSC; con el nonce dejan de necesitar
 *   `unsafe-inline`. `strict-dynamic` permite que esos scripts carguen los
 *   suyos sin listar cada origen.
 * - **`style-src` sí lleva `unsafe-inline`.** No es negociable hoy: Next inyecta
 *   estilos en línea y varios componentes calculan `style` en tiempo de
 *   ejecución (anchos de columna, posiciones del kanban). Un nonce no basta
 *   porque son atributos `style`, no etiquetas `<style>`.
 * - **`img-src` incluye `data:` y `blob:`.** Logos y avatares se guardan como
 *   data URL, y las previsualizaciones antes de subir son blobs.
 * - **En desarrollo hace falta `unsafe-eval`**: el refresco en caliente lo usa.
 *
 * @param {{ nonce: string, isDev?: boolean }} args
 * @returns {string}
 */
export function buildCsp({ nonce, isDev = false }) {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    isDev ? "'unsafe-eval'" : '',
  ].filter(Boolean);

  const directives = [
    ['default-src', ["'self'"]],
    ['script-src', scriptSrc],
    ['style-src', ["'self'", "'unsafe-inline'"]],
    ['img-src', ["'self'", 'data:', 'blob:']],
    ['font-src', ["'self'", 'data:']],
    // La app solo habla con su propio origen; las integraciones salientes
    // (Resend, Meta, Stripe) se llaman desde el servidor, no desde el navegador.
    ['connect-src', ["'self'"]],
    ['form-action', ["'self'"]],
    ['frame-ancestors', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['object-src', ["'none'"]],
    ['frame-src', ["'none'"]],
  ];

  const policy = directives.map(([name, values]) => `${name} ${values.join(' ')}`);
  // Fuerza HTTPS en subrecursos; en local no aplica porque no hay HTTPS.
  if (!isDev) policy.push('upgrade-insecure-requests');

  return policy.join('; ');
}
