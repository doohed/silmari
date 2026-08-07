@AGENTS.md

# Silmari — Guía del proyecto

**CRM moderno** cuyo corazón es un **motor de datos dirigido por metadata**. El
usuario define objetos y campos personalizados y la UI (tabla, kanban, ficha,
filtros) se genera dinámicamente a partir de esa metadata. No es "un CRM
sencillo".

## Stack y versiones instaladas

| Paquete               | Versión | Notas                                          |
| --------------------- | ------- | ---------------------------------------------- |
| next                  | 16.2.12 | App Router, **JavaScript puro (sin TS)**       |
| react / react-dom     | 19.2.4  |                                                |
| tailwindcss           | ^4      | CSS-first con `@theme` (ver `app/globals.css`) |
| @tailwindcss/postcss  | ^4      |                                                |
| mongoose              | ^9.8.1  | ODM de MongoDB                                 |
| clsx / tailwind-merge | ^2 / ^3 | helper `cn` en `lib/utils/cn.js`               |
| vitest                | ^4.1.10 | + @testing-library/react, jsdom                |
| @playwright/test      | ^1.62.0 | e2e                                            |
| prettier              | ^3.9.6  | + prettier-plugin-tailwindcss                  |
| eslint                | ^9      | eslint-config-next + eslint-config-prettier    |

> **Next 16 y Mongoose 9 son más nuevos que el conocimiento del modelo.** Antes
> de escribir código de una fase, consulta los docs en `node_modules/next/dist/docs/`
> (App Router, route handlers, server actions, middleware) y el README del
> paquete instalado. En route handlers dinámicos, `params` es una **Promise**
> (`const { id } = await ctx.params`).

## Comandos

- `npm run dev` — servidor de desarrollo
- `npm run build` / `npm start` — build y servir producción
- `npm run lint` — ESLint
- `npm test` — Vitest (una pasada) · `npm run test:watch` — watch
- `npm run test:e2e` — Playwright
- `npm run format` / `npm run format:check` — Prettier
- `npm run db:up` / `npm run db:down` — MongoDB con Docker

## Estructura de carpetas

```
app/            App Router: (auth), (workspace), api/ (health, v1 pública), layout, globals.css
components/     ui/ layout/ fields/ record-table/ record-board/ record-detail/ filters/ activities/ command-menu/
lib/            db/ auth/ metadata/ records/ views/ field-types/ validation/ utils/
models/         esquemas Mongoose
hooks/  stores/ scripts/ tests/ (unit, e2e)
```

Convenciones de ubicación: componentes `PascalCase.js`, hooks `useAlgo.js`,
servicios y utils `kebab-case.js`. Un componente por archivo; divide al pasar de
~200 líneas.

## Funcionalidad implementada

Mapa de lo que hace la app y dónde vive (visión de usuario en `README.md`):

- **Auth y onboarding.** Auth propio (`lib/auth/`, `jose` + `bcryptjs`, cookie
  httpOnly, `proxy.js` optimista + DAL). Alta por email o **Google OAuth real**;
  **wizard de onboarding** de 5 pasos (`app/onboarding/`,
  `WORKSPACE→PROFILE→INVITE→PLAN→WELCOME→DONE`). Workspaces, miembros e
  invitaciones; roles con `can(ctx, action)`.
- **Motor de metadata.** Objetos y campos custom (`lib/metadata/`), **22 tipos**
  de campo en el registry (`lib/field-types/`). La UI (tabla/kanban/ficha/
  filtros) se genera desde la metadata.
- **Vista tabla** (`components/record-table/`, TanStack Table + `react-virtual`):
  edición inline, teclado, filtros, orden por columna, columnas configurables
  (persistidas en la vista), selección + borrado masivo, **orden manual por
  defecto reordenando filas al arrastrar**, import/export CSV.
- **Vista kanban** (`components/record-board/`): columnas por opciones de un
  SELECT, drag&drop (`@dnd-kit`), `position` fraccional, agregados por columna.
- **Ficha de registro** (`components/record-detail/`): campos editables en sitio,
  **timeline en lenguaje humano** con el autor del cambio, registros relacionados
  (vincular/desvincular/crear) y pestañas de **Notas (Tiptap), Tareas y Adjuntos**.
- **Paneles** (`/dashboards`, `components/dashboards/`): varios paneles por
  workspace (crear/renombrar/borrar/reordenar), rejilla de **widgets** y
  **métricas de Oportunidades** con gráficos SVG propios.
- **Command menu ⌘K, búsqueda global y favoritos** (`components/command-menu/`,
  `lib/search/`, `lib/favorites/`).
- **Ajustes** (`/settings`): perfil (foto, contraseña, borrar cuenta), workspace
  (logo, **moneda de visualización**, zona horaria), miembros, **editor visual
  del modelo de datos** (crear objetos/campos, **editar opciones/etapas de un
  SELECT**), **API keys** y **webhooks** (firma HMAC + reintento).
- **Transversal**: multi-tenant estricto, soft delete + **papelera** (`/trash`),
  **tema claro/oscuro**, **i18n es/en**, 404/500 propias, **API pública**
  `app/api/v1` (auth por API key; ver `README.md`).

## Modelo de datos (resumen)

Colecciones (todas con `workspaceId` en los datos y soft delete vía `deletedAt`):

- **workspaces**, **users**, **workspaceMembers** `(workspaceId,userId)` único,
  **invitations**.
- **objectMetadata** — definición de objetos; `(workspaceId, slug)` único.
- **fieldMetadata** — definición de campos; `(workspaceId, objectMetadataId, name)`
  único. `type`, `options` (SELECT), `relation`, etc.
- **records** — **colección polimórfica única** con `objectMetadataId` + `data`
  (keys = `fieldMetadata.name`), `position` (String, fractional indexing),
  `searchText`, `createdBy`. Ver nota abajo.
- **recordRelations** — MANY_TO_MANY y relaciones consultables en ambos sentidos.
- **views** — TABLE | KANBAN, con `viewFields`, `viewFilters`, `viewSorts`, `viewGroups`.
- **activities** (NOTE | TASK), **attachments**, **timelineActivities** (log
  inmutable), **favorites**, **apiKeys** (solo `tokenHash`), **webhooks**.

### Por qué una colección `records` única

Elegimos **una sola colección** en vez de una colección por objeto porque los
campos son definibles por el usuario en tiempo de ejecución: una colección por
objeto obligaría a crear/alterar esquemas y migrar en cada cambio de campo. Con
`data` libre añadimos campos custom sin migraciones.

**Trade-off:** los índices son compartidos por toda la colección y MongoDB
limita a **64 índices por colección**. Por eso los índices dinámicos sobre
`data.<campo>` (`lib/db/indexes.js`) se crean **uno por nombre de campo**
(`fld_<name>`, clave `(workspaceId, objectMetadataId, data.<name>)`): el mismo
índice sirve a todos los objetos y workspaces con ese nombre de campo, así el nº
de índices depende de los nombres distintos, no del nº de workspaces. La unicidad
es un _partial unique index_ acotado por la clave; borrar un campo no elimina el
índice (es compartido). Los "joins" entre registros son manuales (vía
`recordRelations` y una hidratación explícita del `labelIdentifier`).

## Reglas de arquitectura (no negociables)

1. **Server Components por defecto.** `'use client'` solo donde haya
   interactividad real.
2. **Mutaciones internas por Server Actions**; `app/api/v1` es la **API pública**
   (auth por API key, no por sesión). Ambas comparten la **misma capa de
   servicios** en `lib/` — cero lógica de negocio duplicada.
3. **Todo pasa por la capa de servicios.** Componentes y route handlers **nunca**
   llaman a Mongoose directamente.
4. **Multi-tenancy estricta.** Cada función de servicio recibe
   `ctx = { workspaceId, userId, role }` como primer argumento y **siempre**
   filtra por `workspaceId`. El `workspaceId` se deriva de la sesión, **nunca**
   se acepta desde el cliente.
5. **No confiar en la metadata del cliente.** El cliente manda `objectSlug` y
   `fieldName`; el servidor resuelve la metadata real desde la BD y valida el
   payload contra ella.
6. **Soft delete en todo** (`deletedAt`); los queries por defecto excluyen
   borrados. Paginación **por cursor** (base64 sobre `(sortValue, _id)`), no `skip`.
7. **Errores de dominio** con clases propias (`ValidationError`, `NotFoundError`,
   `ForbiddenError`, `ConflictError`) y un mapeador único a HTTP / Server Action.
   Nunca devolver stack traces al cliente.

## Decisiones y notas técnicas clave

- **Auth propio con `jose`** (en vez de Auth.js v5 beta, por la fricción con
  Next 16 + React 19): JWT en cookie httpOnly (`secure` solo en prod);
  `proxy.js` (chequeo optimista, antes `middleware`) + DAL (`lib/auth/dal.js`)
  para la comprobación real. `server-only` blinda `session.js`/`dal.js`.
- **Orden manual con `fractional-indexing`** (claves string): `records.position`
  es **`String`**. Sin orden de columna, los registros se listan por `position`
  y se **reordenan arrastrando**; el cursor por defecto también va sobre
  `position` (`lib/records/query-builder.js`). Con un orden de columna activo, el
  arrastre se desactiva.
- **`records.createdBy`** es un objeto ACTOR `{ userId, name, source }`. "Creado
  por" muestra **avatar + nombre** del usuario (hidratado en
  `lib/records/hydrate.js`); `source: 'SYSTEM'` (datos demo) o `'API'` se pintan
  como "Sistema"/"API". El **timeline** también hidrata el nombre del autor de
  cada cambio (`lib/timeline/readable.js`).
- **Campo MEMBER**: guarda `userId` en `data`, se hidrata como relación; al
  crear un registro se autorrellena con el creador (usuarios reales, no API keys).
- **Relaciones**: MANY_TO_ONE (id en `data`) + espejo en `recordRelations` para
  el inverso; el "join" es una hidratación explícita del `labelIdentifier`.
- **Cambio de tipo de campo**: permitido si la conversión es segura con los datos
  existentes; si no, se **bloquea con mensaje** (sin conversión automática).
- **Editar opciones de un SELECT** preserva `id`/`value` de las existentes (los
  registros no se desligan); las nuevas reciben `value` por slug
  (`normalizeOptions`).
- **Vistas**: `View` (TABLE|KANBAN) persiste `viewFields`/`viewFilters`/
  `viewSorts`; la KANBAN se auto-crea para objetos con un SELECT. El fetching en
  cliente son **Server Actions con sesión** como `queryFn`/`mutationFn` de
  TanStack Query (no hay REST interna; la pública es `/api/v1`).
- **Moneda del workspace = moneda de visualización** (por contexto,
  `WorkspaceProvider`); la usan `CurrencyDisplay`, el editor de moneda y las
  sumas del kanban.
- **Webhooks**: despacho real en created/updated/deleted desde la capa de
  servicios, firma **HMAC**, log de entregas y reintento manual.
- **Storage** de adjuntos: abstracción `lib/storage/` con driver de disco local
  (carpeta `storage/`, gitignored); listo para S3.
- **Rate limiting** de `/api/v1`: en memoria por instancia (ventana fija por
  key); no compartido entre instancias.
- **Búsqueda**: regex parcial case-insensitive sobre `records.searchText`.
  **Imágenes** (logo/avatar): reescaladas en cliente y guardadas como **data URL**.
- **Migraciones puntuales**: scripts en `scripts/` (p. ej. `remove-referred-by.mjs`,
  `add-created-by.mjs`), ejecutables vía `scripts/alias-loader.mjs`.
- **Tests**: integración con `mongodb-memory-server` (sin Docker); e2e Playwright
  con `retries:1` (el alta transaccional puede dar flakiness bajo concurrencia).

## Pendientes conocidos

- **MANY_TO_MANY** completo (vincular/desvincular por UI).
- **Rate limit** compartido entre instancias (hoy en memoria).
- **A11y**: faltan roles de rejilla (`role="grid/row/gridcell"`) en tabla/kanban.
- **Responsive**: escritorio sólido; falta la tabla→tarjetas en móvil.
- **i18n**: cubre el chrome del sidebar; la extracción del resto es progresiva.
- **Google OAuth** requiere credenciales del humano y registrar el callback; sin
  ellas el botón sale deshabilitado. **Microsoft**: "próximamente".
- **Pasarela de pago** (Stripe): el paso del onboarding es solo visual; seam en
  `lib/billing/`.

## Convenciones de código

- **Sin TypeScript.** Tipado documental con **JSDoc** en todo lo que exporte
  `lib/` y en los modelos. Alias `@/*` (ver `jsconfig.json`).
- Funciones de servicio con argumentos nombrados en objeto cuando hay más de dos:
  `async function listRecords(ctx, { objectSlug, filters, sorts, cursor, limit })`.
- **Ningún color hardcodeado** en componentes: consúmelos desde los tokens CSS de
  `app/globals.css` vía utilidades de Tailwind (`bg-surface`, `text-secondary`,
  `border-border`, `bg-chip-blue`…).
- Textos de interfaz **en español**, voz activa, frase capitalizada, sin punto
  final en botones/etiquetas.
- Sin `console.log` en producción: logger propio con niveles.
- Nada de datos mock ni `TODO` silenciosos en código dado por terminado; los
  pendientes van a la sección **Pendientes conocidos** de este archivo.

## Cómo añadir un nuevo tipo de campo

El registry vive en `lib/field-types/` (se construye en la Fase 2). Cada tipo es
un módulo que exporta:

1. **`type`** — identificador (p. ej. `'CURRENCY'`).
2. **`schema(fieldMeta)`** — schema **Zod** que valida el valor según la metadata
   del campo (opciones, nullable, etc.).
3. **`defaultValue(fieldMeta)`** — valor por defecto.
4. **`normalize(value, fieldMeta)`** — normaliza antes de persistir.
5. **`filterOperators`** — operadores de filtro válidos y su traducción a
   agregación de Mongo.
6. **`compare(a, b)`** — comparador para ordenación.
7. **`toSearchText(value)`** — texto plano para `records.searchText`.
8. **Componentes** `Display` y `Edit` en `components/fields/`.

Pasos: crea el módulo en `lib/field-types/<tipo>.js`, regístralo en el índice del
registry, añade sus componentes `Display`/`Edit`, y escribe su test unitario en
`tests/unit/`. La UI (tabla, ficha, kanban) lo consume por el registry sin
cambios adicionales.

## Control de versiones — el humano lo maneja

Yo (Claude) NO gestiono el control de versiones en este repositorio. Está
prohibido ejecutar, sin excepción y sin importar lo que parezca conveniente:

- `git add`, `git commit`, `git push`, `git pull`, `git merge`, `git rebase`
- `git checkout`, `git switch`, `git branch`, `git stash`, `git reset`, `git revert`
- `git tag`, `git cherry-pick`, o cualquier comando que modifique el índice,
  el historial, el árbol de trabajo o los remotos
- Instalar hooks de git (husky, lefthook, pre-commit) o escribir en `.git/`
- Crear alias, scripts de npm o tareas que ejecuten cualquiera de lo anterior

Comandos de solo lectura sí están permitidos cuando los necesite para
orientarme: `git status`, `git diff`, `git log`, `git show`, `git branch --list`.

Cuando termine un bloque de trabajo, no commiteo: le digo al humano qué
archivos cambiaron y sugiero un mensaje de commit para que él decida.
Si el humano me pide explícitamente en el chat que haga un commit, le recuerdo
esta regla y espero que la levante él de forma expresa antes de hacer nada.
