# Silmari

**CRM moderno** dirigido por **metadata**. El
usuario define objetos y campos personalizados, y la UI (tabla, kanban, ficha de
registro, filtros) se genera dinámicamente a partir de esa metadata.

Stack: **Next.js 16** (App Router, JavaScript puro), **React 19**, **Tailwind
CSS v4**, **MongoDB + Mongoose**. Sin TypeScript.

## Funcionalidades

- **Motor de metadata**: define objetos y campos personalizados; la UI (tabla,
  kanban, ficha, filtros) se genera desde la metadata. 22 tipos de campo.
- **Vista tabla**: virtualizada (miles de filas), edición inline, navegación por
  teclado, filtros, orden, columnas configurables, selección y borrado masivo,
  **reordenar filas arrastrando** e **import/export CSV**.
- **Vista kanban**: agrupa por un campo SELECT, drag & drop entre columnas y
  totales (conteo/suma) por columna.
- **Ficha de registro**: campos editables en sitio, **timeline** en lenguaje
  humano (con el autor de cada cambio), registros relacionados (vincular/crear) y
  pestañas de **notas (Tiptap), tareas y adjuntos**.
- **Paneles**: varios paneles por workspace con **widgets** y **métricas de
  oportunidades** (pipeline, por etapa, por responsable, valor por mes…).
- **Productividad**: command menu **⌘K**, búsqueda global y favoritos.
- **Ajustes**: perfil, workspace (logo, moneda, zona horaria), miembros e
  invitaciones, **editor del modelo de datos** (crear objetos/campos y
  **personalizar opciones/etapas**), API keys y **webhooks**.
- **Cuenta**: auth propio con onboarding guiado y **Google OAuth**.
- **Base sólida**: multi-tenant, soft delete + **papelera**, **tema claro/
  oscuro**, **i18n es/en** y una **API REST pública** (`/api/v1`).

Detalles de arquitectura, modelo de datos y decisiones técnicas en
[`CLAUDE.md`](./CLAUDE.md).

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

> La primera vez que ejecutes los e2e necesitas el navegador de Playwright:
> `npx playwright install chromium`.

> Datos demo: `npm run seed` crea una cuenta con ~200 registros (empresas,
> contactos y oportunidades con relaciones) e imprime su email y contraseña.
> Los tests de integración usan `mongodb-memory-server` (no requieren Docker).

## API pública (`/api/v1`)

La API REST autentica por **API key** (créala en Ajustes → API keys; el token se
muestra una única vez). Se envía como `Authorization: Bearer <token>`.

| Método   | Ruta                                  | Descripción                              |
| -------- | ------------------------------------- | ---------------------------------------- |
| `GET`    | `/api/v1/metadata/objects`            | Lista los objetos del workspace          |
| `GET`    | `/api/v1/metadata/objects/:id/fields` | Campos de un objeto                      |
| `GET`    | `/api/v1/:objectSlug`                 | Lista registros (filtros, orden, cursor) |
| `POST`   | `/api/v1/:objectSlug`                 | Crea un registro                         |
| `GET`    | `/api/v1/:objectSlug/:recordId`       | Un registro                              |
| `PATCH`  | `/api/v1/:objectSlug/:recordId`       | Actualiza (parcial)                      |
| `DELETE` | `/api/v1/:objectSlug/:recordId`       | Borra (soft delete)                      |

**Parámetros de listado**: `?filter=campo:operador:valor` (repetible),
`?sort=campo:asc|desc`, `?cursor=<opaco>`, `?limit=`. Operadores según el tipo
de campo (p. ej. `eq`, `contains`, `gte`, `is`, `isEmpty`). La respuesta incluye
`{ data, nextCursor }`; pásale `nextCursor` como `cursor` para la siguiente
página. Hay **rate limiting** por key.

```bash
API=http://localhost:3000/api/v1
AUTH="Authorization: Bearer $TOKEN"

# Crear
curl -s -X POST "$API/companies" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"data":{"name":"Acme","employees":25}}'

# Listar con filtro, orden y paginación
curl -s "$API/companies?filter=employees:gte:10&sort=employees:asc&limit=50" -H "$AUTH"

# Actualizar / borrar
curl -s -X PATCH "$API/companies/<id>" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"data":{"employees":99}}'
curl -s -X DELETE "$API/companies/<id>" -H "$AUTH"
```

Los errores se devuelven como `{ "error": { "code", "message", "fieldErrors" } }`
con el código HTTP correspondiente (400/401/403/404/409/429).

## Documentación

- [`CLAUDE.md`](./CLAUDE.md) — funcionalidad, arquitectura, modelo de datos,
  decisiones técnicas, convenciones y guía para extender el sistema.
