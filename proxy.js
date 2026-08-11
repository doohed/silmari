import { NextResponse } from 'next/server';
import { decryptSession, SESSION_COOKIE } from '@/lib/auth/jwt';

/**
 * Proxy (antes "middleware" en Next ≤15). SOLO hace chequeos optimistas: lee la
 * cookie y redirige. La autorización real vive en el DAL (`lib/auth/dal.js`),
 * cerca de los datos.
 */

const PUBLIC_PREFIXES = ['/welcome', '/login', '/signup', '/invite', '/forms'];
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
  return NextResponse.next();
}

export const config = {
  // No ejecutar en API, assets de Next ni ficheros con extensión.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)'],
};
