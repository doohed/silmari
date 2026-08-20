import { lookup } from 'node:dns/promises';
import { ValidationError } from '@/lib/errors/domain-errors';

/**
 * Guardia contra SSRF para las URLs que el usuario nos da para que **nosotros**
 * las llamemos (hoy, los webhooks salientes).
 *
 * El problema que resuelve: nuestro servidor puede llegar a sitios que el
 * cliente no puede — el Mongo del propio host, el panel de un vecino en la red
 * privada, y sobre todo el **endpoint de metadatos del proveedor de nube**
 * (`169.254.169.254`), que en muchos entornos entrega credenciales a quien lo
 * pida desde dentro. Sin esta comprobación, un ADMIN convierte la función de
 * webhooks en un cliente HTTP con nuestros privilegios de red, y el
 * `statusCode` que se le devuelve en el log de entregas le sirve de oráculo
 * para ir barriendo.
 *
 * Se comprueba **dos veces**: al guardar el webhook y otra vez justo antes de
 * cada `fetch`. Solo lo primero no basta — un dominio que hoy resuelve a una IP
 * pública puede resolver mañana a `127.0.0.1` (DNS rebinding), y el destino no
 * es nuestro.
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Puertos admitidos. Es una lista blanca corta a propósito: sin ella, nuestro
 * servidor sirve de escáner de puertos contra terceros. Si algún día hace falta
 * admitir un receptor autoalojado en un puerto raro, se añade aquí.
 */
const ALLOWED_PORTS = new Set(['', '80', '443', '8080', '8443']);

/** ¿Es `n` un entero entre 0 y 255? */
const isByte = (n) => Number.isInteger(n) && n >= 0 && n <= 255;

/**
 * Descompone una IPv4 en sus cuatro bytes, o null si no lo es.
 * @param {string} ip
 * @returns {number[] | null}
 */
function parseIpv4(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const bytes = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return bytes.every(isByte) ? bytes : null;
}

/**
 * Rangos IPv4 que no deben salir de casa. Además de los privados clásicos van
 * los que llevan a sitios raros: link-local (metadatos de la nube), CGNAT,
 * multicast y reservados.
 * @param {number[]} b
 */
function isPrivateIpv4([a, b, c]) {
  if (a === 0) return true; // 0.0.0.0/8 "esta red"
  if (a === 10) return true; // privada
  if (a === 127) return true; // loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
  if (a === 169 && b === 254) return true; // 169.254/16 link-local (metadatos)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12 privada
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // IETF / TEST-NET-1
  if (a === 192 && b === 168) return true; // privada
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast (224/4) y reservados (240/4)
  return false;
}

/**
 * ¿Esta dirección lleva a la red interna (o a un sitio donde no pintamos nada)?
 *
 * Módulo puro y sin red: es la parte que conviene tener bien cubierta por tests.
 *
 * @param {string} address IP literal, v4 o v6
 * @returns {boolean}
 */
export function isPrivateAddress(address) {
  const ip = String(address ?? '')
    .trim()
    .toLowerCase();
  if (!ip) return true; // sin dirección, no se sale

  const v4 = parseIpv4(ip);
  if (v4) return isPrivateIpv4(v4);

  // IPv6 con IPv4 dentro: ::ffff:127.0.0.1 y el prefijo NAT64 64:ff9b::/96.
  // Se decide por la IPv4 que llevan encajada, no por el envoltorio.
  const embedded = ip.match(/^(?:::ffff:|64:ff9b::)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (embedded) {
    const bytes = parseIpv4(embedded[1]);
    return bytes ? isPrivateIpv4(bytes) : true;
  }

  const bare = ip.split('%')[0]; // quita el identificador de zona (fe80::1%eth0)
  if (bare === '::' || bare === '::1') return true; // sin especificar / loopback
  if (/^f[cd]/.test(bare)) return true; // fc00::/7 direcciones locales únicas
  if (/^fe[89ab]/.test(bare)) return true; // fe80::/10 link-local
  if (/^ff/.test(bare)) return true; // ff00::/8 multicast

  // Si no es una IP reconocible, no se sale: preferimos un falso negativo a
  // dejar pasar algo que no sabemos leer.
  if (!bare.includes(':')) return true;
  return false;
}

/**
 * ¿Hay que hacer cumplir la guardia de red?
 *
 * Solo en **producción**. En desarrollo y en los tests se apunta un webhook a un
 * receptor local a propósito (`http://127.0.0.1:4010/hook`, un túnel, un
 * dominio `.test` que no resuelve), y bloquearlo dejaría la función imposible
 * de probar sin aportar nada: el riesgo de SSRF es tener una red interna y
 * credenciales que robar, y eso solo pasa en el servidor de verdad.
 *
 * Mismo criterio que ya sigue el resto de la app con `secure` en las cookies y
 * el prefijo `__Host-`: el comportamiento se endurece en producción.
 */
function enforcedByDefault() {
  return process.env.NODE_ENV === 'production';
}

/**
 * Valida que una URL se pueda llamar desde el servidor sin apuntar hacia dentro.
 * Resuelve el DNS, así que hay que llamarla también **justo antes** del `fetch`.
 *
 * @param {string} rawUrl
 * @param {{ enforce?: boolean }} [opts] `enforce` fuerza la comprobación de red
 *   aunque no estemos en producción (lo usan los tests).
 * @returns {Promise<URL>} la URL ya parseada
 * @throws {ValidationError} con un mensaje que se puede enseñar tal cual
 */
export async function assertPublicUrl(rawUrl, { enforce = enforcedByDefault() } = {}) {
  const invalid = (message) =>
    new ValidationError(message, { fieldErrors: { targetUrl: [message] } });

  let url;
  try {
    url = new URL(String(rawUrl ?? '').trim());
  } catch {
    throw invalid('La URL de destino no es válida');
  }

  // El esquema se comprueba siempre: un `file://` no es un webhook en ningún
  // entorno. Lo que se relaja fuera de producción es a dónde puede apuntar.
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw invalid('La URL de destino tiene que empezar por http:// o https://');
  }
  if (!enforce) return url;

  if (!ALLOWED_PORTS.has(url.port)) {
    throw invalid(`El puerto ${url.port} no está admitido para un webhook`);
  }

  // Una IPv6 literal llega entre corchetes (`[::1]`) y así `dns.lookup` no la
  // resuelve: se quitan antes de preguntar.
  const hostname = url.hostname.replace(/^\[|\]$/g, '');

  let addresses;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw invalid(`No se puede resolver el dominio "${hostname}"`);
  }

  // Basta con que UNA de las direcciones sea interna: un dominio que resuelve a
  // varias podría usarse para colar la que interesa.
  if (addresses.some((a) => isPrivateAddress(a.address))) {
    throw invalid('La URL de destino apunta a una dirección interna');
  }

  return url;
}
