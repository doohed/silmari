import { pathToFileURL, fileURLToPath } from 'node:url';
import { existsSync, statSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';

/**
 * Loader de Node para ejecutar scripts que importan la capa de servicios:
 * - resuelve el alias `@/*` (como jsconfig),
 * - resuelve imports relativos SIN extensión (`./scalar` → `./scalar.js`),
 * - neutraliza el guard `server-only` (solo tiene sentido en react-server).
 *
 * Uso: node --loader ./scripts/alias-loader.mjs scripts/mi-script.mjs
 */

const ROOT = process.cwd();
const EMPTY = pathToFileURL(`${ROOT}/tests/stubs/empty.js`).href;

function resolveFile(base) {
  for (const c of [base, `${base}.js`, `${base}.mjs`, `${base}/index.js`]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier === 'server-only' || specifier === 'client-only') {
    return { url: EMPTY, shortCircuit: true };
  }
  if (specifier.startsWith('@/')) {
    const file = resolveFile(`${ROOT}/${specifier.slice(2)}`);
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
    const base = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
    const file = resolveFile(base);
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }
  return next(specifier, context);
}
