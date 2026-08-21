@AGENTS.md

# Silmari — Guía del proyecto

**CRM moderno** cuyo corazón es un **motor de datos dirigido por metadata**. El
usuario define objetos y campos personalizados y la UI (tabla, kanban, ficha,
filtros) se genera dinámicamente a partir de esa metadata. No es "un CRM
sencillo".

## Stack y versiones instaladas

| Paquete               | Versión | Notas                                          |
| --------------------- | ------- | ---------------------------------------------- |
| next                  | 16.3.1  | App Router, **JavaScript puro (sin TS)**       |
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
- `npm run shots [rutas…]` — capturas de la UI en claro y oscuro (`.ui-shots/`),
  para revisar el front sin abrir el navegador. Necesita el dev server y la
  cuenta demo (`npm run seed`); credenciales por `SHOT_EMAIL`/`SHOT_PASSWORD`,
  tema con `THEME=dark`, viewport con `W`/`H`. Guarda la sesión en
  `.ui-shots/.session.json` porque el freno anti-fuerza bruta solo deja 5 logins
  por email cada 15 min.
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
  httpOnly, `proxy.js` optimista + DAL). **Recuperación de contraseña** por email
  (`/forgot`, `/reset/[token]`) y **freno anti-fuerza bruta** por email + IP en
  login, alta, olvido y aceptar invitación (`lib/auth/throttle.js`).
  Alta por email o **Google OAuth real**;
  **wizard de onboarding** de 5 pasos (`app/onboarding/`,
  `WORKSPACE→PROFILE→INVITE→PLAN→WELCOME→DONE`). Workspaces, miembros e
  invitaciones; roles con `can(ctx, action)`.
- **Motor de metadata.** Objetos y campos custom (`lib/metadata/`), **24 tipos**
  de campo en el registry (`lib/field-types/`), incluido **FORMULA** (campo
  calculado de solo lectura). La UI (tabla/kanban/ficha/
  filtros) se genera desde la metadata.
- **Vista tabla** (`components/record-table/`, TanStack Table + `react-virtual`):
  edición inline, teclado, filtros, orden por columna, columnas configurables
  (persistidas en la vista), selección + borrado masivo, **orden manual por
  defecto reordenando filas al arrastrar**, **proyección de columnas** (solo pide
  al servidor los campos visibles), import/export CSV y **primera columna
  congelada** al desplazarse en horizontal (como la de cabecera de Numbers). El
  cambio de vista (tabla/kanban) es un **control segmentado** en `RecordViewBar`,
  que con una sola vista se pinta como título.
- **Vista kanban** (`components/record-board/`): columnas por opciones de un
  SELECT, drag&drop (`@dnd-kit`), `position` fraccional, agregados por columna.
- **Ficha de registro** (`components/record-detail/`): se abre pegada a la
  tabla, así que **mide igual que ella**: cabecera `h-12` como `RecordViewBar` y
  fila de pestañas con `.mac-list-head`. Los campos son una lista con hairlines
  sangrados (la ventana "Información" del Finder) y `@container`: por debajo de
  24rem la etiqueta se pone encima del valor, porque el mismo panel vive también
  en la columna de 288 px de la ficha a página completa, donde dos columnas
  fijas cortaban los emails. Campos editables en sitio,
  **timeline en lenguaje humano** con el autor del cambio, registros relacionados
  (vincular/desvincular/crear) y pestañas de **Notas (Tiptap), Tareas y Adjuntos**.
- **Tareas** (`/tasks`, `components/activities/`): bandeja con vista **Lista /
  Calendario mensual**; cada tarea con **fecha límite** (`dueAt`) y **varios
  responsables** (`assigneeIds`). Las tareas pueden ser sueltas (sin registro) o
  vinculadas; las notas siempre van vinculadas.
- **Paneles** (`/dashboards`, `components/dashboards/`): varios paneles por
  workspace (crear/renombrar/borrar/reordenar), rejilla de **widgets** y
  **métricas de Oportunidades** con gráficos SVG propios. El índice es la
  **misma lista** que la de registros (mismas primitivas de `globals.css`:
  `.mac-list-head`, `.mac-row`, `.mac-list-fill`), aunque escrita a mano —
  columnas fijas, sin metadata, sin TanStack Table. La **última columna se
  estira**: con todas fijas, la banda de cabecera terminaba a media lámina.
  El lienzo de widgets tiene **suelo propio** (`--canvas`), no la lámina blanca:
  unas tarjetas blancas con borde sobre blanco no se leen como tarjetas. Pero
  tampoco `--bg`, que es lo que se probó primero: el rail lateral es ese mismo
  gris y se ve justo al lado, así que la lámina desaparecía y el panel parecía un
  hueco recortado en la ventana. `--canvas` queda **entre** la tarjeta y el fondo
  de la ventana en los **dos** temas — por eso tampoco vale `--sunken`, que en
  oscuro es más claro que `--surface`.
  El **detalle de un panel** (`/dashboards/[id]`, `DashboardView`) tiene la misma
  anatomía que una ficha de registro: barra de `h-12` (volver + nombre editable +
  recuento) y debajo una **banda `.mac-list-head` con los paneles hermanos como
  pestañas** (`.mac-tab`) más un «+» para crear. Que el nombre salga a la vez en
  la barra y en la pestaña activa **no es una repetición**: es el reparto de una
  ventana con pestañas del sistema — el título dice dónde estás (y es donde se
  renombra), las pestañas son solo navegación. Cada widget es una **lámina
  pequeña** (`.mac-widget`, hermana de `.mac-sheet`: mismo remate `--elev-sheet`,
  sin `border` de 1 px) **con la misma banda de título** que la cabecera de
  columnas de la tabla; eso es lo que hace que el panel se lea como parte de la
  app y no como un dashboard web incrustado. En edición el **asa de arrastre es
  la banda entera**, como la barra de título de una ventana: de `useSortable` se
  toman solo los `listeners`, **nunca los `attributes`** (ponen `role="button"` y
  la banda contiene botones — anidarlos es ARIA inválido y hacía que se anunciara
  «… 2×2 cambiar Quitar widget»); los botones de dentro cortan el `pointerdown`
  o un clic de tres píxeles se convierte en arrastre. La tarjeta **no se tiñe de
  acento al editar**: con ocho a la vez la rejilla entera se volvía naranja y el
  acento deja de marcar nada. El control de tamaño **dice el tamaño** (`2×2`) en
  vez de llevar icono: en 13 px `Scaling` se leía como «abrir en otra ventana».
  El cuerpo de la tarjeta es un **`@container`** (un widget mide entre 1/4 y 4/4
  de la rejilla; un `md:` no distingue una tarjeta de 1×1 de una de 4×2 en la
  misma pantalla) y `StatTile` escoge cuerpo por ahí, no por el largo del número:
  con una escalera por longitud, cuatro cifras en fila salían cada una de un
  tamaño. En `BarChart` la etiqueta de valor se ancla a la **columna** y se sube
  con `bottom: calc(<pct>% + 4px)`: colgada de la barra (40 px) un importe se
  recortaba a «2.14…».
- **Command menu ⌘K, búsqueda global y favoritos** (`components/command-menu/`,
  `lib/search/`, `lib/favorites/`).
- **Ajustes** (`/settings`): perfil (foto, contraseña, **idioma**, borrar cuenta),
  workspace (logo, **moneda de visualización**, zona horaria), miembros, **editor
  visual del modelo de datos** (crear objetos **con icono** / campos, **editar
  opciones/etapas de un SELECT**, **indexar campos**, **borrar objetos custom**),
  **API keys**, **webhooks** (firma HMAC + reintento) y **entrada de leads**
  (formularios de Meta vía Zapier/Make).
- **Chrome**: el sidebar es un **rail completo** (menú de usuario, buscador,
  nombre de workspace, navegación); en escritorio no hay barra superior, y en
  móvil (`SidebarShell`) pasa a ser una barra con menú y un cajón lateral.
  La lista de registros cambia a **tarjetas** por debajo de `md` (`RecordCards`).
  **Todas las secciones de Ajustes se pintan igual**, con el patrón de la página
  de Perfil: `SettingsPage` (columna `max-w-2xl`, solo el título — **sin párrafo
  de descripción y sin acciones en la cabecera**, que harían saltar el título al
  cambiar de sección) y dentro, listas agrupadas de `SettingsGroup` /
  `SettingsRow` (`components/ui/SettingsGroup.js`). Una fila = etiqueta a la
  izquierda, control a la derecha; `hint` para lo que el control no dice,
  `footnote` del grupo para lo que hay que explicar una vez, `stacked` cuando el
  control es ancho. Los botones de "añadir" van **en una fila del primer grupo**,
  no flotando sobre la lista, y una cosa con varios ajustes propios (un webhook,
  un formulario, una integración) es **un grupo con su nombre de título**. Si
  añades una sección nueva, no escribas el `div` y el `h1` a mano: eso es lo que
  hizo que ninguna midiera igual que la de al lado.
  ⚠️ El checkbox propio (`appearance:none` en `globals.css`) **no tiene tamaño
  intrínseco**: sin una clase `size-*` se queda en un punto invisible.
  **Ajustes no es una página a pantalla completa**: `components/settings/SettingsShell.js`
  lo abre como **ventana flotante** (diálogo de Radix siempre abierto) sobre el
  resto de la app difuminada; se cierra con Escape, la X o el clic fuera, y al
  cerrar navega a `/` (moverse entre secciones apila historial, así que
  `router.back()` devolvería a la sección anterior en vez de salir). Mide **lo
  mismo en todas las secciones** y anima entrada y salida (`.settings-window` /
  `.settings-scrim` en `globals.css`); como el diálogo no se desmonta al cerrar
  (se navega), la salida se marca con `data-closing` y la navegación espera lo
  que dura. **Ojo al animar cualquier caja centrada**: Tailwind v4 compila
  `-translate-x-1/2` a la propiedad **`translate`**, no a `transform`, y las dos
  se componen; si el centrado viene de Tailwind, el keyframe **no** debe repetir
  `translate(-50%, -50%)` (desplazaba el doble y el diálogo entraba pegado a la
  esquina superior izquierda hasta que acababa la animación — le pasaba a
  `ConfirmDialog`, `ImportDialog` y la hoja de atajos). O el centrado lo pone la
  propia clase dentro de `transform` (`.settings-window`) y el keyframe lo
  repite, o lo pone Tailwind y el keyframe solo escala (`dialog-in`); mezclarlos
  es lo que rompe. Popovers/menús propios
  cierran al clic fuera (`hooks/useClickOutside`); confirmaciones con diálogo
  temático (`components/ui/ConfirmDialog`, `useConfirm`) en vez de `window.confirm`.
- **Transversal**: multi-tenant estricto, soft delete + **papelera** (`/trash`),
  **tema claro/oscuro**, **i18n es/en**, 404/500 propias, **API pública**
  `app/api/v1` (auth por API key; ver `docs/api.md`).

## Modelo de datos (resumen)

Colecciones (todas con `workspaceId` en los datos y soft delete vía `deletedAt`):

- **workspaces**, **users**, **workspaceMembers** `(workspaceId,userId)` único,
  **invitations**.
- **passwordResets** — token de recuperación: solo el `tokenHash` (sha256), TTL
  de 1 h con índice `expireAfterSeconds`, `usedAt` para que valga una sola vez.
- **emailVerifications** — igual, pero TTL de 3 días y con el `email` al que se
  emitió: si la cuenta cambia de dirección, el token deja de valer.
- **subscriptions** — espejo local de Stripe, único por `workspaceId`. Solo lo
  escribe el webhook. Sin documento = plan Gratis (no se crea fila hasta el
  primer pago).
- **stripeEvents** — `_id` = `event.id` de Stripe; la clave primaria hace de
  guardia de idempotencia. TTL de 30 días.
- **objectMetadata** — definición de objetos; `(workspaceId, slug)` único
  **parcial** (`deletedAt: null`), para que un objeto borrado no bloquee reusar el
  slug. `createObject` añade el identificador `name` (indexado) y el campo de
  sistema **"Creado por"** (ACTOR).
- **fieldMetadata** — definición de campos; `(workspaceId, objectMetadataId, name)`
  único **parcial** (`deletedAt: null`). `type`, `options` (SELECT), `relation`,
  `isIndexed`, etc.
- **records** — **colección polimórfica única** con `objectMetadataId` + `data`
  (keys = `fieldMetadata.name`), `position` (String, fractional indexing),
  `searchText`, `createdBy`. Ver nota abajo.
- **recordRelations** — MANY_TO_MANY y relaciones consultables en ambos sentidos.
- **views** — TABLE | KANBAN, con `viewFields`, `viewFilters`, `viewSorts`, `viewGroups`.
- **activities** (NOTE | TASK): tareas con `dueAt` y `assigneeIds` (varios
  responsables); `targets` polimórficos opcionales (tareas sueltas permitidas).
- **attachments**, **timelineActivities** (log inmutable), **favorites**,
  **apiKeys** (solo `tokenHash`), **webhooks**.
- **leadIntakes** — configuración de entrada de leads; único por
  `(workspaceId, provider, formId)`. Objeto destino, `mappings`,
  `dedupeFieldName`, contadores y log de las últimas entradas.

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
- **Un JWT no se revoca; se corta por fecha.** `User.sessionsValidFrom` es el
  sustituto: cambiar o restablecer la contraseña la adelanta, e `isSessionCurrent`
  (`lib/auth/jwt.js`, puro) descarta en el DAL toda sesión firmada antes. Sin
  esto, a quien le roban la cuenta cambia la contraseña y **la sesión del
  atacante sigue viva hasta 7 días**. Dos detalles que hay que respetar: el `iat`
  del token va en **segundos**, así que la comparación es `>=` (si no, quien
  cambia su contraseña se echa a sí mismo); y `changePasswordAction`
  **re-emite la cookie** después de cambiarla, capturando el ctx _dentro_ de
  `withCtx` — releerlo después ya no valdría, porque la cookie de la petición ha
  dejado de ser válida.
- **Los valores de filtro se coaccionan a escalares** (`coerceFilterValue` en
  `lib/field-types/helpers.js`, aplicado en `query-builder.js` y en el motor de
  automatizaciones). Los `buildFilter` de cada tipo incrustan el valor directo en
  el match, así que un objeto lo leería Mongo como **operador** (`{$regex}`,
  `{$ne}`…) y el cliente pasaría de elegir un filtro a escribir la consulta —
  con una regex de backtracking catastrófico, a quemar la CPU de la BD. Mismo
  motivo por el que `decodeCursor` descarta un `sortValue` que no sea escalar.
  Si añades un tipo de campo nuevo, **no** repitas la coacción en su
  `buildFilter`: ya viene hecha del llamante.
- **El valor de orden tiene que ser un escalar, o la paginación se rompe en
  silencio.** El cursor va sobre `(sortValue, _id)` y `decodeCursor` descarta
  todo `sortValue` que sea un objeto (si no, el cliente escribiría operadores de
  Mongo dentro del match). Un tipo compuesto sin `sortPath` metía el
  subdocumento entero en el cursor: se descartaba al decodificarlo, la petición
  de la página 2 iba **sin recorte** y devolvía otra vez la página 1 — la lista
  repetía registros al hacer scroll y React se quejaba de keys duplicadas, sin
  un solo error en el log. Por eso cada tipo declara o bien un **`sortPath` a una
  hoja escalar** (FULL_NAME → `.firstName`, CURRENCY → `.amount`, ADDRESS →
  `.city`, ACTOR → `.source`) o bien **`isSortable: false`** cuando no la hay
  (arrays: EMAILS, PHONES, LINKS, MULTI_SELECT, LINE_ITEMS, ARRAY, RAW_JSON; y
  los calculados FORMULA/ROLLUP, que no se persisten). `buildQuery` rechaza
  ordenar por un campo no ordenable y `buildNextCursor` **lanza** si el valor no
  es escalar: vale más reventar donde el mensaje señala al tipo que le falta el
  `sortPath` que devolver filas duplicadas.
- **El recuento de la barra es el total de la vista**, no las filas cargadas:
  `listRecords` devuelve `total` (un `countDocuments` **solo en la primera
  página**, que sin cursor el match ya es el filtro completo). Antes se pasaba
  `rows.length` y el número subía de 100 a 200 a 300 según se hacía scroll.
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
- **Unicidad de metadata parcial**: los índices únicos de `objectMetadata`
  (`slug`) y `fieldMetadata` (`name`) filtran por `deletedAt: null`, así un
  objeto/campo borrado (soft delete) no bloquea reusar su slug/nombre.
- **Proyección de columnas**: `listRecords(ctx, { fieldNames })` proyecta solo
  `data.<campoVisible>` + raíz (`position/createdAt/createdBy`) + el campo de
  orden (para el cursor), e hidrata solo las relaciones visibles. La tabla pasa
  sus columnas visibles (menos payload con 2000+ filas).
- **Índices de `records`**: el orden por defecto va por
  `(ws, obj, deletedAt, position, _id)` (sin SORT en memoria). Los índices
  dinámicos **no-únicos** (`fld_<name>`, `lib/db/indexes.js`) tienen forma
  `(ws, obj, deletedAt, data.<campo>, _id)` para cubrir **filtro + orden** por esa
  columna. El identificador se auto-indexa; hay un toggle "indexar" por campo en
  el editor. Compartidos por nombre de campo (límite de 64 índices/colección).
- **Tareas** (`lib/activities/`): `assigneeIds` (varios responsables; si se crea
  sin ninguno → el creador, así sale en "Mías"), `dueAt`; tareas **sueltas** (sin
  `targets`) permitidas. `listTasks` acepta `from`/`to` (rango por `dueAt`) para el
  calendario mensual.
- **`initialData` de react-query** solo se pasa cuando la vista está en su estado
  inicial (`RecordTable`); si se pasa siempre, se reaplica a cada queryKey nueva y,
  con `staleTime`, la tabla no refresca al ordenar/filtrar.
- **UI transversal**: `useConfirm` (`components/ui/ConfirmDialog`, Radix) reemplaza
  `window.confirm`; toasts estilados con los tokens (sin `richColors`);
  `hooks/useClickOutside` cierra popovers al clic fuera; **checkbox propio**
  (`appearance:none` en `globals.css`) porque Safari no repinta el nativo con
  `color-scheme`. `revalidatePath('/', 'layout')` en las acciones de objeto para
  que el sidebar refleje crear/renombrar/borrar al instante. Idioma en Ajustes →
  Perfil (cookie `locale`).
- **Vistas**: `View` (TABLE|KANBAN) persiste `viewFields`/`viewFilters`/
  `viewSorts`; la KANBAN se auto-crea para objetos con un SELECT. El fetching en
  cliente son **Server Actions con sesión** como `queryFn`/`mutationFn` de
  TanStack Query (no hay REST interna; la pública es `/api/v1`).
- **Moneda del workspace = moneda de visualización** (por contexto,
  `WorkspaceProvider`); la usan `CurrencyDisplay`, el editor de moneda y las
  sumas del kanban.
- **Dos remitentes de correo distintos, no los mezcles.** `lib/mailer/` es el
  **correo de sistema** (recuperar contraseña, invitaciones): driver **Resend**
  por REST con `fetch`, sin SDK; sin `RESEND_API_KEY` cae al driver `console`,
  que no envía y escribe el enlace en el log (así el flujo funciona en local).
  `sendSystemEmail` **nunca lanza**: un fallo de correo no debe tumbar el alta ni
  la invitación. `lib/email/` es otra cosa: el **SMTP por workspace** para que el
  usuario escriba a sus clientes desde la ficha. Si un cliente desconecta su
  SMTP, sus invitaciones deben seguir saliendo.
- **Recuperación de contraseña** (`lib/accounts/password-reset.js`): token de un
  solo uso con TTL de 1 h, en BD solo el hash. `requestPasswordReset` **resuelve
  igual exista la cuenta o no** (si no, el formulario sería un detector de
  cuentas registradas); pedir un enlace nuevo invalida el anterior, y cambiar la
  contraseña desde Ajustes invalida los pendientes. No inicia sesión al terminar:
  manda al login.
- **Verificación de email** (`lib/accounts/email-verification.js`): solo el alta
  pública (`createEmailAccount`) nace sin confirmar. `provisionAccount` acepta
  `emailVerified` con **default `true`**, para que OAuth, seeds, scripts y tests
  no arrastren el bloqueo; aceptar una invitación también confirma (el token
  solo estaba en ese buzón). `assertEmailVerified` bloquea **invitar, API keys y
  webhooks**, que es donde una cuenta falsa haría daño; consulta la BD y no el
  `ctx`, porque el JWT pudo emitirse antes de confirmar, y deja pasar a las API
  keys (no tienen buzón). **Excepción deliberada**: el paso de invitar del
  onboarding pasa `requireVerifiedEmail: false`; ocurre segundos después del alta
  y exigirlo lo dejaría inútil para todo el mundo, así que el riesgo se acota con
  el tope de 3 direcciones y el freno de altas por IP.
- **Despliegue** (ver `docs/runbook.md`): **nginx en el host** (TLS con certbot) → app
  en `standalone` (Docker) → Mongo (Docker). La app publica el 3000 **atado a
  `127.0.0.1`**: nginx llega por loopback y desde internet no se puede tocar
  saltándose el TLS. En la config de nginx, `X-Forwarded-For` debe fijarse con
  `$remote_addr` y **no** con `$proxy_add_x_forwarded_for`, que lo añade en vez
  de reemplazarlo y permitiría falsear la IP para saltarse
  `lib/auth/throttle.js`. Ojo también con `client_max_body_size`: por defecto son
  1 MB y los adjuntos fallarían con 413. Las cookies de sesión y de estado de
  OAuth llevan prefijo **`__Host-` solo en producción** (exige `Secure`, que en
  localhost no viaja); el nombre se decide **en build**, así que desplegarlo la
  primera vez cierra las sesiones abiertas. **`NEXT_PUBLIC_APP_URL` se incrusta
  en el build**: la imagen queda atada a su dominio y cambiarlo obliga a
  reconstruir, no basta con reiniciar.
- **Legal y RGPD**: los datos de la empresa viven en `lib/config/legal.js`, y
  mientras queden marcadores `[[...]]` las páginas `/legal/*` muestran un aviso
  de borrador (`legalIsDraft()`). **No hay banner de cookies a propósito**: las
  únicas cookies son la de sesión, `theme`, `locale` y las de estado de OAuth,
  todas necesarias o de preferencia del usuario, y no hay analítica de terceros;
  añadir una obligaría a implantar consentimiento previo. La **exportación**
  (`lib/accounts/export-workspace.js` → `/api/export`) incluye la metadata de
  objetos y campos, no solo los datos: sin ella `data` sería un diccionario
  opaco. El **borrado definitivo** lo hace `scripts/purge-deleted.mjs` a los 30
  días; ojo, los registros arrastran sus **relaciones e historial**, que no
  tienen `deletedAt` propio y hay que borrar por id del registro.
- **Facturación** (`lib/billing/`): **los límites viven en código**
  (`plans.js`, puro) y Stripe solo dice _qué ha pagado_ el workspace, no _qué
  puede hacer_; así un cambio en el panel de Stripe no altera en silencio lo que
  la app permite. `assertWithinPlan` se aplica en la **capa de servicios** (API
  keys, webhooks, miembros, entradas de leads y `createRecord`), no en la UI,
  porque la API pública comparte esos servicios. `past_due` **conserva** el plan:
  un cobro fallido no corta el servicio antes de que Stripe agote sus reintentos;
  `canceled`/`unpaid` degradan a Gratis. El webhook
  (`app/api/stripe/webhook/route.js`) lee el **cuerpo crudo** (la firma va sobre
  los bytes), es **idempotente** por `event.id` (`models/StripeEvent.js`, con TTL
  de 30 días) y responde 200 ante un fallo de procesado: un 500 solo provoca
  reintentos que no arreglan un fallo permanente. Aquí sí se usa el **SDK
  oficial**, al revés que en `lib/mailer/`: verificar la firma con tolerancia
  temporal y comparación en tiempo constante es fácil de hacer mal y esto mueve
  dinero. Sin `STRIPE_SECRET_KEY` la app arranca igual y la UI esconde los
  botones de contratar. El **paso PLAN del onboarding** abre el mismo Checkout y
  vuelve a `/onboarding`; el destino de retorno sale de una **lista blanca
  cerrada** (`RETURN_PATHS`), porque aceptar una URL del cliente sería una
  redirección abierta servida desde el dominio de Stripe.
- **Cabeceras de seguridad** (`lib/http/security-headers.js`, puro y testeado):
  las estáticas (HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`,
  `X-Frame-Options`) se declaran en `next.config.mjs`; la **CSP se emite desde
  `proxy.js`** porque lleva un **nonce por respuesta**, que no cabe en la config
  estática. El nonce viaja en la cabecera de petición y Next firma con él sus
  scripts en línea de RSC, así que `script-src` **no necesita `unsafe-inline`**.
  `style-src` sí lo lleva y hoy no se puede quitar: hay atributos `style`
  calculados en runtime (anchos de columna, posiciones del kanban) que un nonce
  no cubre. `img-src` admite `data:`/`blob:` por los avatares y logos.
- **Adjuntos** (`lib/attachments/limits.js`): **lista blanca** de MIME y tope de
  10 MB, validados **antes** de escribir en el storage. `text/html` y
  `image/svg+xml` quedan fuera porque el navegador los ejecutaría como documento
  desde nuestro propio origen; por lo mismo, `/api/files/:id` solo sirve
  `inline` los tipos inofensivos y fuerza `attachment` para el resto, con
  `nosniff` y `Cache-Control: private, no-store`.
- **Freno de autenticación** (`lib/auth/throttle.js`): las server actions de auth
  no pasan por `api-context`, así que llaman a `throttleAuth(flow, { email })`,
  que consume cupo **por email y por IP** a la vez. Hereda la limitación de
  `rate-limit.js`: memoria por instancia.
- **Log de eventos de seguridad** (`logSecurityEvent` en `lib/utils/logger.js`):
  prefijo `[sec]` para poder `grep`earlo, y el `email` **enmascarado**
  (`an***@gmail.com`) porque un log lleno de direcciones en claro es un fichero
  de datos personales que hay que justificar. Registran: login fallido, freno
  disparado, alta/revocación de API key, alta o **bloqueo** de webhook, cambio de
  contraseña, borrado de cuenta y expulsión de un miembro. No hay agregador: esto
  se lee a mano con `docker compose logs`.
- **El login tarda lo mismo exista la cuenta o no.** `authenticate` compara
  contra un **hash señuelo** cuando no hay usuario. El mensaje genérico no basta
  por sí solo: sin bcrypt, la respuesta volvía en milisegundos y el formulario
  quedaba convertido en un detector de direcciones registradas.
- **Un id imposible se responde 404, no 500.** `to-response.js` traduce los
  `CastError`/`BSONError` de Mongoose: desde fuera un id que no puede existir no
  se distingue de uno que no existe, y así deja de ensuciar el log de errores
  (que es donde se buscan los fallos de verdad).
- **`INTEGRATIONS_SECRET` ≠ `AUTH_SECRET`.** El cifrado de los secretos de
  integraciones usa su propia variable (con fallback a `AUTH_SECRET` por
  compatibilidad) para que rotar el secreto de sesión no deje ilegibles los
  secretos de todos los workspaces. Migración: `scripts/rotate-integration-secret.mjs`.
- **Webhooks**: despacho real en created/updated/deleted desde la capa de
  servicios, firma **HMAC**, log de entregas y reintento manual. El destino pasa
  por `assertPublicUrl` (`lib/http/safe-url.js`) **dos veces**: al guardarlo y
  otra vez justo antes de cada `fetch`. La segunda no sobra: un dominio que hoy
  resuelve a una IP pública puede resolver mañana a `127.0.0.1` (DNS rebinding).
  Sin esta guardia, un ADMIN apunta el webhook a `169.254.169.254` y la función
  se convierte en un cliente HTTP con nuestros privilegios de red — y el
  `statusCode` del log de entregas le hace de oráculo. Las redirecciones **no se
  siguen** (`redirect: 'manual'`), porque un destino público podría contestar
  302 hacia dentro. ⚠️ La comprobación de red **solo se aplica en producción**:
  en dev y en los tests se apunta a `127.0.0.1` a propósito y bloquearlo dejaría
  la función imposible de probar. Si la pruebas en local y "no bloquea", es esto.
- **Los adjuntos también tienen tope de plan** (`storageBytes` en
  `lib/billing/plans.js`, `assertStorageWithinPlan`): 10 MB por archivo sin tope
  de conjunto son tantos MB como peticiones quepan, y con el storage en disco
  local llenar el disco se lleva por delante también a Mongo. Va aparte de
  `assertWithinPlan` porque se cuenta en bytes, no en unidades.
- **El CSV exportado neutraliza las fórmulas** (`lib/records/csv.js`, puro).
  Excel y Sheets interpretan como fórmula toda celda que empiece por `=`, `+`,
  `-` o `@`, y los datos entran por sitios que no controlamos (formulario
  público, leads de Meta): un lead llamado `=HYPERLINK(...)` se lleva la fila al
  abrirlo. Entrecomillar **no** basta — las comillas son del formato CSV y la
  hoja las quita antes de mirar el contenido; hay que anteponer `'`.
- **Topes de operaciones masivas** en `lib/records/limits.js` (puro, compartido
  con el cliente como `lib/attachments/limits.js`): 1000 filas por import, 500
  ids por lote. Se aplican en el **servicio**, no en la UI, porque por ahí pasan
  también la API pública y las server actions; lo del diálogo es solo un aviso
  temprano.
- **Entrada de leads** (`lib/leads/`): `POST /api/v1/intake/meta` (API key con
  scope `records:write`) recibe leads de **Meta Lead Ads** reenviados por
  Zapier/Make. Es **entrante**, al revés que `lib/webhooks/` (saliente). El
  `workspaceId` sale de la API key, nunca del payload; la config se elige por
  `form_id` con una comodín (`formId: ''`) de reserva.
  `normalize-payload.js` es **puro** y acepta las tres formas del lead (webhook
  crudo `entry[].changes[].value`, `field_data` de la Graph API y el objeto
  aplanado de Zapier), normalizando el nombre de cada pregunta (sin tildes,
  signos ni mayúsculas). Los formularios mandan texto plano, así que el servicio
  traduce a los tipos compuestos del CRM: `"Ana Ruiz"` → FULL_NAME, un email
  suelto → EMAILS, y una etiqueta de SELECT → su `value`. La **deduplicación**
  (`lib/leads/dedupe.js`, puro y compartido con el cliente) solo admite tipos
  comparables de forma exacta y confirma la coincidencia en memoria: `EMAILS`
  únicamente ofrece el operador `contains`, que es subcadena y casaría
  `ana@x.com` con `juana@x.com`.
- **Storage** de adjuntos: abstracción `lib/storage/` con driver de disco local
  (carpeta `storage/`, gitignored); listo para S3.
- **Rate limiting**: en memoria por instancia (ventana fija por key,
  `lib/http/rate-limit.js`); **no compartido entre instancias**. Cubierto hoy:
  `/api/v1` (120/min por API key), formularios públicos (20/min por IP+slug),
  `/api/upload` (60/min por workspace), `/api/export` (**3/hora** por workspace:
  vuelca el workspace entero y es el endpoint más caro que hay) y los flujos de
  auth (`lib/auth/throttle.js`). Las demás server actions no llevan freno.
  ⚠️ **Esto para el abuso, no una avalancha**: para que se mire un contador que
  vive dentro del proceso de Node, la petición ya ha llegado hasta ahí. El corte
  ante un flood es `limit_req` de nginx y un CDN por delante — configuración y
  criterio en `docs/runbook.md`.
- **Búsqueda**: regex parcial case-insensitive sobre `records.searchText`.
  **Imágenes** (logo/avatar): reescaladas en cliente y guardadas como **data URL**.
- **Migraciones puntuales**: scripts en `scripts/` (p. ej.
  `remove-referred-by.mjs`, `add-created-by.mjs`, `optimize-record-indexes.mjs`,
  `fix-metadata-unique-indexes.mjs`, `migrate-task-assignees.mjs`), ejecutables
  vía `scripts/alias-loader.mjs`. Idempotentes; se corren una vez por entorno.
- **⚠️ Cambios de esquema de un modelo → reiniciar el dev server.** Los modelos
  usan `mongoose.models.X || mongoose.model(...)`, así que un hot-reload conserva
  el **esquema compilado anterior** y descarta campos nuevos (p. ej. añadir
  `assigneeIds`). Tras editar un `models/*.js`, reinicia `npm run dev`. (Cambios
  de datos/índices no lo requieren: se aplican por script de migración.)
- **Tests**: integración con `mongodb-memory-server` (sin Docker); e2e Playwright
  con `retries:1` (el alta transaccional puede dar flakiness bajo concurrencia).

## Pendientes conocidos

> **Puesta en producción:** el plan por fases (cuentas, endurecimiento, Stripe,
> legal, operación) vive en **`docs/plan-produccion.md`**, y los procedimientos
> de backup y recuperación en **`docs/runbook.md`**. Consúltalos antes de tocar
> despliegue, auth o facturación.

- **MANY_TO_MANY** completo (vincular/desvincular por UI).
- **Rate limit** compartido entre instancias (hoy en memoria).
- **A11y**: faltan roles de rejilla (`role="grid/row/gridcell"`) en tabla/kanban.
- **Responsive**: hecho en la lista de registros y el chrome. Falta repasar la
  ficha, el kanban y los ajustes en pantallas estrechas.
- **i18n**: cubre el chrome del sidebar; la extracción del resto es progresiva.
- **Google y Microsoft OAuth** están **implementados** (`lib/auth/oauth/`,
  rutas `app/api/auth/{google,microsoft}/`). Requieren credenciales del humano y
  registrar el callback (`{APP_URL}/api/auth/<proveedor>/callback`); sin
  `*_CLIENT_ID`/`*_CLIENT_SECRET` el botón sale deshabilitado. Microsoft usa
  `MICROSOFT_TENANT` ('common' por defecto). Un mismo email es una sola cuenta,
  sea cual sea el proveedor.
- **Pasarela de pago** (Stripe): el paso del onboarding es solo visual; seam en
  `lib/billing/`.
- **Campos calculados (FORMULA)**: hechos (evaluador puro `lib/field-types/
formula-eval.js`, cálculo en `hydrate`, config en `settings.formula`, editor en
  el modelo de datos). Son **solo lectura y no filtrables ni ordenables en BD**
  (el valor no se persiste). Falta **ROLLUP** (agregados sobre registros
  relacionados) y **productos/cotizaciones con líneas** (Fase 4 pendiente).
- **Envío de email y WhatsApp**: **implementado**. Se conectan en Ajustes →
  Integraciones (`lib/integrations/`, secretos cifrados con `lib/utils/crypto`).
  Email por **SMTP** (`nodemailer`; con Gmail, contraseña de aplicación);
  WhatsApp por la **Cloud API de Meta** (`phone_number_id` + token, POST a la
  Graph API). Los proveedores (`lib/email/provider.js`, `lib/whatsapp/provider.js`)
  leen la conexión del workspace; si no hay ninguna, `sendEmail`/`sendWhatsapp`
  avisan de que falta conectar. Se envía desde la **pestaña Comunicaciones** de la
  ficha (con plantillas). Pendiente: **OAuth de Gmail/Outlook** (alternativa al
  SMTP) y **recepción entrante** (webhook de WhatsApp / sync IMAP).

## Convenciones de código

- **Sin TypeScript.** Tipado documental con **JSDoc** en todo lo que exporte
  `lib/` y en los modelos. Alias `@/*` (ver `jsconfig.json`).
- Funciones de servicio con argumentos nombrados en objeto cuando hay más de dos:
  `async function listRecords(ctx, { objectSlug, filters, sorts, cursor, limit })`.
- **Ningún color hardcodeado** en componentes: consúmelos desde los tokens CSS de
  `app/globals.css` vía utilidades de Tailwind (`bg-surface`, `text-secondary`,
  `border-border`, `bg-chip-blue`…).
- **Estética macOS.** El fondo de la app es gris (`--bg`, la "ventana") y el
  contenido vive en una lámina blanca redondeada que flota encima; el rail
  lateral **comparte ese mismo gris** (`--sidebar: var(--bg)`): no es una
  superficie aparte, es el hueco alrededor de la lámina. Por lo mismo la sombra
  de la lámina (`--elev-sheet`) va **corta**: el hueco son 8 px y un difuminado
  ancho lo teñía entero, haciendo que el marco y el rail parecieran de tonos
  distintos aunque el token sea el mismo. Las primitivas están en `globals.css` y
  se usan por clase, no repitiendo la receta:
  - `.mac-sheet` — la lámina de contenido (solo redondea en `md+`).
  - `.mac-vibrancy` — fondo del rail y de las barras de navegación.
  - `.mac-menu` — material de popovers, desplegables y diálogos.
  - `.mac-widget` — lámina pequeña (tarjeta del panel): el remate de
    `.mac-sheet` un escalón por debajo, sin `border` de 1 px.
  - `.mac-segment` — control segmentado; el estado se lee de `aria-pressed` o
    `data-active`, sin clases condicionales en el marcado.
  - `.mac-list-head` / `.mac-tab` — la **banda de títulos** y sus pestañas. La
    altura sale de `--list-head-h`, que es **fuente única**: la comparten la
    cabecera de columnas de la tabla, la fila de pestañas de la ficha y la
    cabecera "Detalles" de la columna lateral, que se ven las tres a la vez y
    tienen que cerrar en la misma línea (por eso ese número **no** vive en JS;
    el rayado de fondo también se desplaza por él). Los divisores verticales
    solo salen con `data-cols`: en las pestañas convertirían la fila en una
    tabla. Lo activo es una **pastilla en relieve**, no un subrayado: en 30 px el
    subrayado se pega al hairline de abajo y se lee como un borde suelto.
  - `.mac-focus` — halo ancho de foco (no un borde de 1 px).
  - `.mac-disabled` — estado deshabilitado de un control **con relleno**: gris
    apagado y plano. **No uses `disabled:opacity-*` en un botón de acento**: un
    naranja a media opacidad no se lee como "apagado", se lee como "roto", y en
    la acción primaria es justo el que más canta. La clase resetea el
    `background` en forma corta a propósito, que es lo que mata la veladura de
    `.mac-gloss`. En el `ghost` no se usa (no tiene relleno: se apaga bajando el
    rótulo a `text-tertiary`, porque darle fondo lo haría _más_ visible al
    deshabilitarse).
  - `.mac-gloss` — la veladura de blanco de botones y desplegables. Va por el
    token `--gloss`, que en **oscuro es `transparent`**: la misma veladura que da
    relieve sobre un fondo claro, sobre uno oscuro se lee como una rampa de gris
    claro a gris oscuro, y en una ventana llena de controles es la ventana entera
    la que parece degradada. Los controles del modo oscuro de macOS son planos.
    Medido: el `Select` iba de `#37373a` a `#2a2a2d` sobre una tarjeta de
    `#242427`. **No uses `from-white/…` suelto en un control**, usa esta clase.
    ⚠️ Estas clases van **sin `@layer`**, así que ganan a cualquier utilidad de
    Tailwind aunque se escriba después en el `className` (un `max-md:rounded-none`
    junto a `.mac-sheet` no haría nada). Lo responsive se resuelve dentro de la
    propia clase con un media query.
- **La tabla de registros se pinta como la vista de lista del Finder**, no como
  una tabla web. Cuatro reglas, todas en `globals.css` (`.mac-list-head`,
  `.mac-row`, `.mac-freeze`, `.mac-list-fill`) y usadas por
  `components/record-table/`:
  - **Bandas alternas en vez de una línea bajo cada fila.** Nada de `border-b`
    por fila: una rejilla de hairlines es justo lo que hace que una tabla se lea
    "web". Las bandas **siguen hasta el fondo** aunque se acaben los registros
    (`.mac-list-fill` es un `repeating-linear-gradient` con
    `background-attachment: local` sobre el contenedor con scroll; por eso
    `ROW_H`/`HEAD_H` viven en JS y en CSS a la vez — si se cambia uno sin el
    otro, las bandas dejan de coincidir con las filas).
  - **Las filas son opacas**, no una veladura sobre la lámina: la primera
    columna va congelada (`position: sticky`) y hereda ese fondo; con un fondo
    translúcido se vería el texto de las demás columnas pasando por debajo.
  - **Divisores verticales solo en la cabecera.** Y la cabecera va en texto
    normal, **no en versalitas**: las mayúsculas con `tracking` ancho son la
    marca del dashboard web; el sistema escribe la etiqueta tal cual y marca la
    columna ordenada tiñéndola.
  - **Las columnas numéricas se alinean a la derecha** (`fieldAlign` en
    `CellContent.js`) con `tabular-nums`, como la columna "Tamaño" del Finder.
    Solo números: alinear texto a la derecha deja un borde irregular.
  - Los **checkboxes se esconden** mientras no haya selección viva (aparecen al
    pasar el cursor), y el **anillo de celda activa** solo se pinta con la
    rejilla enfocada y después de elegir una celda — `active` arranca en `-1`.
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
   5b. **`sortPath(base)`** o **`isSortable: false`** — obligatorio si el valor del
   campo **no es un escalar**. `sortPath` devuelve la ruta a una hoja escalar
   (`` `${base}.amount` ``); si no existe ninguna (arrays, calculados), marca el
   tipo como no ordenable. Ver la nota sobre el cursor más arriba: saltarse esto
   no da un error, da filas duplicadas.
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
