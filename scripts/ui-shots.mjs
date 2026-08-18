/**
 * Capturas de pantalla del front para revisar la UI sin abrir el navegador.
 *
 * Uso:
 *   node scripts/ui-shots.mjs                    # rutas por defecto, claro + oscuro
 *   node scripts/ui-shots.mjs /tasks /settings   # rutas concretas
 *   THEME=dark node scripts/ui-shots.mjs         # solo un tema
 *   OUT=/ruta node scripts/ui-shots.mjs          # carpeta de salida
 *
 * Requiere el dev server en marcha y una cuenta demo (`npm run seed`).
 * Credenciales por env: SHOT_EMAIL / SHOT_PASSWORD.
 */
import { chromium } from '@playwright/test';
import { mkdir, access } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const EMAIL = process.env.SHOT_EMAIL ?? 'demo_1786038696719@silmari.dev';
const PASSWORD = process.env.SHOT_PASSWORD ?? 'demo1234';
const OUT = process.env.OUT ?? '.ui-shots';
const THEMES = process.env.THEME ? [process.env.THEME] : ['light', 'dark'];
const VIEWPORT = { width: Number(process.env.W ?? 1440), height: Number(process.env.H ?? 900) };

const routes = process.argv.slice(2);
const ROUTES = routes.length
  ? routes
  : ['/objects/companies', '/objects/opportunities', '/dashboards', '/tasks', '/settings/profile'];

const slug = (r) => (r === '/' ? 'home' : r.replace(/^\//, '').replace(/\//g, '-'));

await mkdir(OUT, { recursive: true });

// La sesión se guarda entre ejecuciones a propósito: el freno anti-fuerza bruta
// (`lib/auth/throttle.js`) solo deja 5 logins por email y ventana, y sacar
// capturas varias veces seguidas agotaba el cupo.
const SESSION = path.join(OUT, '.session.json');
const hasSession = await access(SESSION).then(
  () => true,
  () => false,
);

const browser = await chromium.launch();
let context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 2,
  ...(hasSession ? { storageState: SESSION } : {}),
});
let page = await context.newPage();

async function login() {
  await page.goto(`${BASE}/login`);
  await page.getByPlaceholder('Email').fill(EMAIL);
  await page.getByPlaceholder('Contraseña').fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 });
  await context.storageState({ path: SESSION });
}

// Con sesión guardada basta comprobar que sigue viva; si caducó, se reentra.
await page.goto(`${BASE}${ROUTES[0]}`);
if (new URL(page.url()).pathname.startsWith('/login')) await login();

for (const theme of THEMES) {
  await context.addCookies([{ name: 'theme', value: theme, url: BASE }]);
  for (const route of ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600); // animaciones de entrada
    const file = path.join(OUT, `${slug(route)}.${theme}.png`);
    await page.screenshot({ path: file });
    console.log(file);
  }
}

await browser.close();
