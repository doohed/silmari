# Silmari

**CRM moderno** dirigido por **metadata**. El
usuario define objetos y campos personalizados, y la UI (tabla, kanban, ficha de
registro, filtros) se genera dinámicamente a partir de esa metadata.

Stack: **Next.js 16** (App Router, JavaScript puro), **React 19**, **Tailwind
CSS v4**, **MongoDB + Mongoose**. Sin TypeScript.

## Funcionalidades

- **Motor de metadata**: define objetos y campos personalizados; la UI (tabla,
  kanban, ficha, filtros) se genera desde la metadata. 24 tipos de campo,
  incluidos FORMULA y ROLLUP.
- **Vista tabla**: virtualizada (miles de filas), edición inline, navegación por
  teclado, filtros, orden, columnas configurables, selección y borrado masivo,
  **reordenar filas arrastrando** e **import/export CSV**.
- **Vista kanban**: agrupa por un campo SELECT, drag & drop entre columnas y
  totales (conteo/suma) por columna.
- **Ficha de registro**: campos editables en sitio, **timeline** en lenguaje
  humano (con el autor de cada cambio), registros relacionados (vincular/crear) y
  pestañas de **notas (Tiptap), tareas y adjuntos**.
- **Tareas**: bandeja global con vista **Lista / Calendario mensual**, **fecha
  límite** y **varios responsables** por tarea; también dentro de cada ficha.
- **Paneles**: varios paneles por workspace con **widgets** y **métricas de
  oportunidades** (pipeline, por etapa, por responsable, valor por mes…).
- **Productividad**: command menu **⌘K**, búsqueda global y favoritos.
- **Ajustes**: perfil (con idioma), workspace (logo, moneda, zona horaria),
  miembros e invitaciones, **editor del modelo de datos** (crear objetos con
  **icono** / campos, **personalizar opciones/etapas**, **indexar campos**,
  **borrar objetos custom**), API keys y **webhooks**.
- **Cuenta**: auth propio con onboarding guiado, **Google y Microsoft OAuth**,
  recuperación de contraseña y verificación de email.
- **Facturación**: planes con límites aplicados en servidor, Checkout y portal de
  cliente de **Stripe**.
- **Entrada de leads**: formularios de Meta (Facebook e Instagram) vía Zapier o
  Make, con mapeo de campos y deduplicación configurables.
- **Base sólida**: multi-tenant, soft delete + **papelera**, **tema claro/
  oscuro**, **i18n es/en**, páginas legales, exportación de datos y una
  **API REST pública** (`/api/v1`).

Detalles de arquitectura, modelo de datos y decisiones técnicas en
[`CLAUDE.md`](./CLAUDE.md). El resto de la documentación, en
[`docs/`](./docs/README.md).

## Requisitos

- Node.js 20+
- Docker + Docker Compose (para MongoDB local)

## Puesta en marcha

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env.local
#    Edita .env.local si hace falta. Genera un AUTH_SECRET con:
#    openssl rand -base64 32

# 3. Levantar MongoDB (replica set de un solo nodo, necesario para transacciones)
npm run db:up
#    La primera vez tarda unos segundos en inicializar el replica set.

# 4. Arrancar el servidor de desarrollo
npm run dev
```

Abre <http://localhost:3000>. El health check debería responder `{ ok: true }`:

```bash
curl http://localhost:3000/api/health
# {"ok":true}
```

## Scripts

| Comando                    | Descripción                                       |
| -------------------------- | ------------------------------------------------- |
| `npm run dev`              | Servidor de desarrollo                            |
| `npm run build`            | Build de producción                               |
| `npm start`                | Servir el build de producción                     |
| `npm run lint`             | ESLint                                            |
| `npm test`                 | Tests unitarios (Vitest)                          |
| `npm run test:watch`       | Vitest en modo watch                              |
| `npm run test:integration` | Integración (mongodb-memory-server, sin Docker)   |
| `npm run test:e2e`         | Tests end-to-end (Playwright)                     |
| `npm run seed`             | Datos demo (~200 registros); imprime credenciales |
| `npm run format`           | Formatear con Prettier                            |
| `npm run format:check`     | Comprobar formato sin escribir                    |
| `npm run db:up`            | Levantar MongoDB (Docker)                         |
| `npm run db:down`          | Detener MongoDB (Docker)                          |
| `npm run app:up`           | Levantar el stack de producción (Docker)          |
| `npm run app:down`         | Detener el stack de producción                    |
| `npm run backup`           | Volcado de MongoDB (ver runbook)                  |
| `npm run restore`          | Restaurar un volcado                              |
| `npm run purge`            | Borrado definitivo de la papelera (RGPD)          |

> La primera vez que ejecutes los e2e necesitas el navegador de Playwright:
> `npx playwright install chromium`.

> Datos demo: `npm run seed` crea una cuenta con ~200 registros (empresas,
> contactos y oportunidades con relaciones) e imprime su email y contraseña.
> Los tests de integración usan `mongodb-memory-server` (no requieren Docker).

## Documentación

- [`docs/`](./docs/README.md) — índice completo.
  - [API pública](./docs/api.md) — referencia de `/api/v1`.
  - [Runbook de operación](./docs/runbook.md) — despliegue, backup, incidencias.
  - [Plan de puesta en producción](./docs/plan-produccion.md) — qué falta para lanzar.
- [`CLAUDE.md`](./CLAUDE.md) — arquitectura, modelo de datos, decisiones técnicas
  y convenciones. Se queda en la raíz porque es donde lo carga Claude Code.

## Licencia

Privado. Todos los derechos reservados.
