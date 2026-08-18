import { NextResponse } from 'next/server';
import { decryptSession, SESSION_COOKIE } from '@/lib/auth/jwt';
import { buildCsp } from '@/lib/http/security-headers';

/**
 * Proxy (antes "middleware" en Next ≤15). Hace dos cosas:
 *
 * 1. Chequeos optimistas de sesión: lee la cookie y redirige. La autorización
 *    real vive en el DAL (`lib/auth/dal.js`), cerca de los datos.
 * 2. Emite la **CSP con un nonce por respuesta**. Tiene que ser aquí: el nonce
 *    cambia en cada petición, así que no cabe en `next.config.mjs`. El nonce
 *    viaja también en la cabecera de petición `x-nonce`, que es de donde Next lo
 *    lee para firmar sus propios scripts en línea.
 */

const PUBLIC_PREFIXES = [
  '/welcome',
  '/login',
  '/signup',
  '/invite',
  '/forms',
  '/forgot',
  '/reset',
  '/verify',
  // Las páginas legales tienen que poder leerse antes de registrarse: es
  // justamente cuando se consultan.
  '/legal',
];
const AUTH_ONLY = ['/welcome', '/login', '/signup']; // no accesibles si ya hay sesión

/** @param {import('next/server').NextRequest} req */
export default async function proxy(req) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const session = await decryptSession(req.cookies.get(SESSION_COOKIE)?.value);

  if (!session && !isPublic) {
    // La raíz es la puerta de entrada (landing); el resto pide login directo.
    const target = pathname === '/' ? '/welcome' : '/login';
    return NextResponse.redirect(new URL(target, req.nextUrl));
  }
  if (session && AUTH_ONLY.includes(pathname)) {
    return NextResponse.redirect(new URL('/', req.nextUrl));
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp({ nonce, isDev: process.env.NODE_ENV !== 'production' });

  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);
  headers.set('content-security-policy', csp);

  const res = NextResponse.next({ request: { headers } });
  res.headers.set('content-security-policy', csp);
  return res;
}

export const config = {
  // No ejecutar en API, assets de Next ni ficheros con extensión.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)'],
};
