# Plan de puesta en producción

Camino desde el estado actual hasta abrir Silmari como **SaaS público de pago**
sobre un **VPS con Docker y una sola instancia**.

**Supuestos que fijan el plan** (si cambian, cambia el orden):

- Una instancia. El storage en disco y el rate limit en memoria siguen siendo
  válidos; dejan de serlo el día que haya una segunda réplica o serverless.
- Registro abierto y cobro desde el lanzamiento → verificación de email, Stripe
  y el bloque legal completo son obligatorios, no opcionales.
- Clientes en España/UE → IVA y RGPD aplican desde el primer cobro.

Las estimaciones son para **una persona a jornada completa** e incluyen tests.
Son órdenes de magnitud, no compromisos.

---

## Fase 0 — Red de seguridad · ~1-2 días

Va primero porque protege todo lo que viene después. Sin esto, cada fase
siguiente se despliega a ciegas.

| #   | Tarea                                                                                                                                           | Dónde                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 0.1 | CI en GitHub Actions: `lint` + `test` + `test:integration` + `build` en cada push y PR. Los e2e de Playwright, en nightly (tardan y son flaky). | `.github/workflows/ci.yml`                  |
| 0.2 | Backup automático de Mongo: `mongodump` diario a almacenamiento externo (R2/S3/Backblaze), retención 30 días, cifrado en reposo.                | `scripts/backup.mjs` + cron en el host      |
| 0.3 | **Ensayo de restauración**: restaurar el backup de ayer en local y comprobar que la app arranca contra él. Documentar los pasos.                | `PLAN-PRODUCCION.md` → runbook (Fase 5)     |
| 0.4 | Sentry (o equivalente) en cliente y servidor, enganchado al `logger` propio para no duplicar salidas.                                           | `lib/utils/logger.js`, `instrumentation.js` |
| 0.5 | Monitor externo de uptime sobre `/api/health` con aviso a tu móvil.                                                                             | UptimeRobot / BetterStack                   |

**Terminado cuando:** un PR con los tests en rojo no se puede mergear, y existe
un backup de ayer que has restaurado con éxito al menos una vez.

---

## Fase 1 — Cuentas completas · ~4-6 días

El bloque más importante: hoy un usuario que olvide su contraseña se queda fuera
para siempre y las invitaciones se pasan a mano.

> **Estado: fase completa** (1.1 a 1.6). Para enviar de verdad hay que dar de
> alta el dominio en Resend y poner `RESEND_API_KEY` y `MAIL_FROM`; sin ellas el
> driver `console` escribe el enlace en el log y el flujo funciona igual en local.

### 1.1 Remitente de sistema (habilita 1.2, 1.3 y 1.4)

Nuevo módulo `lib/mailer/` con driver **Resend** (o SES) y un seam para cambiar
de proveedor. **No confundir con `lib/email/`**, que es el SMTP _por workspace_
para que el usuario escriba a sus clientes: son cosas distintas y no deben
compartir configuración.

- Variables nuevas: `MAIL_PROVIDER`, `MAIL_FROM`, `RESEND_API_KEY`.
- Plantillas mínimas coherentes con la marca (layout + botón + pie).
- Registro de envíos para poder depurar entregas.
- Configurar **SPF, DKIM y DMARC** en el dominio, o todo acabará en spam.

### 1.2 Invitaciones por email

`lib/invitations/service.js` ya genera el token; solo falta enviarlo en vez de
devolverlo para copiar a mano. Añadir "reenviar invitación" y caducidad visible.

### 1.3 Recuperación de contraseña

- Modelo `PasswordReset`: token **hasheado**, TTL de 1 hora, un solo uso.
- Páginas `/forgot` y `/reset/[token]` en `app/(auth)/`.
- Invalidar los tokens pendientes al cambiar la contraseña y al usar uno.
- **Respuesta idéntica exista o no la cuenta**, para no filtrar qué emails están
  registrados.

### 1.4 Verificación de email en el alta

Con registro público abierto es la primera defensa contra abuso.
`emailVerifiedAt` en `User`; hasta verificar, la cuenta entra pero con las
acciones sensibles limitadas (invitar, API keys, webhooks).

### 1.5 Rate limit en autenticación

Hoy `consumeRateLimit` solo cubre `/api/v1` (por API key) y `/api/forms/[slug]`
(por IP). Las server actions de login y signup no tienen ningún freno.

- Aplicar en login, signup, forgot y accept-invite.
- Doble clave: por **email** (5 intentos / 15 min) y por **IP** (20 / 15 min).
- Bloqueo temporal progresivo tras varios ciclos fallidos.

### 1.6 Separar `INTEGRATIONS_SECRET` de `AUTH_SECRET`

`lib/utils/crypto.js:15` deriva de `AUTH_SECRET` la clave que cifra los secretos
de integraciones (contraseña SMTP, token de WhatsApp). Rotar `AUTH_SECRET` —lo
que harías ante una fuga— cerraría todas las sesiones **y** dejaría ilegibles
esos secretos.

Hacerlo **ahora**, mientras casi no hay datos cifrados: variable propia con
fallback a `AUTH_SECRET` si no está definida, más
`scripts/rotate-integration-secret.mjs` para re-cifrar lo existente.

**Terminado cuando:** puedes registrarte, verificar el email, olvidar la
contraseña, recuperarla e invitar a alguien, todo por correo real, con un e2e
que recorre el ciclo completo.

---

## Fase 2 — Endurecimiento · ~2-3 días

> **Estado: fase completa.** El 2.3 se cerró junto con la Fase 5: la cookie de
> sesión y las de estado de OAuth llevan el prefijo `__Host-` **solo en
> producción**, porque exige `Secure` y en `http://localhost` rompería el login.
> Verificado contra el build de producción: las seis cabeceras salen, los 14
> scripts de la página llevan nonce y el prefijo está en el bundle. Falta la
> comprobación externa en el dominio real (securityheaders.com) al desplegar.

| #   | Tarea                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2.1 | Cabeceras en `next.config.mjs`: CSP, HSTS, `frame-ancestors 'none'`, `Referrer-Policy`, `X-Content-Type-Options`, `Permissions-Policy`.          |
| 2.2 | La CSP es la parte delicada: Tiptap y las imágenes en data URL necesitan `img-src data:`. Objetivo realista: sin `unsafe-inline` en **scripts**. |
| 2.3 | Cookies de sesión: revisar `sameSite` y valorar el prefijo `__Host-`.                                                                            |
| 2.4 | `/api/upload`: límite de tamaño explícito y lista blanca de MIME.                                                                                |
| 2.5 | Ampliar `tests/integration/tenant-isolation.test.js` a los servicios nuevos (leads, integraciones, dashboards).                                  |
| 2.6 | `npm audit --production` como paso de CI que avisa (no que bloquea, para no frenarte con avisos de dependencias transitivas).                    |

**Terminado cuando:** securityheaders.com da A o superior en el dominio real.

---

## Fase 3 — Facturación con Stripe · ~5-8 días

> **Estado: base hecha, falta la prueba de punta a punta.** Están el modelo
> `Subscription`, los planes con sus límites aplicados en la capa de servicios,
> el webhook idempotente, el Checkout, el portal de cliente y la página
> `/settings/billing`. **Queda**: crear productos y precios en el panel de
> Stripe, poner `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
> `STRIPE_PRICE_PRO` y `STRIPE_PRICE_BUSINESS`, activar **Stripe Tax**, y probar
> el ciclo completo con tarjetas de prueba, reenviando los eventos con
> `stripe listen`. También sigue pendiente conectar el paso PLAN del onboarding
> al Checkout real.

La fase más larga. El paso PLAN del onboarding hoy es solo visual.

- **Modelo `Subscription`** por workspace: plan, estado, `stripeCustomerId`,
  `stripeSubscriptionId`, periodo actual.
- **Planes** definidos en código (Free / Pro / Business) con sus límites.
- **Stripe Checkout** para el alta y **Customer Portal** para tarjeta, facturas y
  cancelación: te ahorra construir toda esa UI y su mantenimiento.
- **Webhook** `POST /api/stripe/webhook`: verificar la firma sobre el **cuerpo
  crudo** (`await req.text()`, igual que en Meta), idempotencia por `event.id` en
  una colección de eventos procesados.
- **Enforcement de límites en la capa de servicios**, nunca solo en la UI:
  nº de registros, miembros, API keys, webhooks, configuraciones de leads.
- **Stripe Tax** para el IVA de España/UE, más facturas descargables. Vendiendo a
  consumidores y empresas de la UE esto no es opcional.
- Conectar el paso PLAN del onboarding al checkout real.

**Terminado cuando:** con tarjetas de prueba puedes suscribirte, ver la factura,
superar un límite y recibir el aviso, cancelar, y que el workspace baje de plan
solo al expirar el periodo.

---

## Fase 4 — Legal y páginas públicas · ~2-3 días + abogado

> **Estado: la parte técnica está hecha; la jurídica depende de tu abogado.**
> Hechas las cuatro páginas (`/legal/*`, públicas y enlazadas), la exportación
> del workspace (`/api/export`, portabilidad) y el borrado definitivo con
> 30 días de gracia (`scripts/purge-deleted.mjs`).
>
> **Banner de cookies: no hace falta.** Auditado contra el código: las únicas
> cookies son `silmari_session`, `theme`, `locale` y las de estado de OAuth, y no
> hay ninguna analítica ni rastreador de terceros. Todas son necesarias o de
> preferencia fijada por el propio usuario, así que no requieren consentimiento
> previo. Si algún día añades analítica, esto cambia.
>
> **Queda**: rellenar `lib/config/legal.js` (razón social, CIF, domicilio, datos
> registrales, emails), que un abogado revise los cuatro textos, redactar el
> **DPA** que firmarán tus clientes y el registro de actividades de tratamiento.
> Mientras queden marcadores, las páginas muestran un aviso de borrador visible.

Puede ir **en paralelo** a la Fase 3: no comparten código.

- Páginas `/legal/privacidad`, `/legal/terminos`, `/legal/cookies` y aviso legal.
- Banner de cookies **solo si metes analítica**. Si no la metes, te lo ahorras:
  decisión de producto, no técnica.
- Como tratas datos de los leads de tus clientes, eres **encargado del
  tratamiento**: necesitas un **DPA** plantilla que firmen y un registro de
  actividades de tratamiento.
- **Export del workspace** (portabilidad) y **borrado real** de la cuenta pasado
  un plazo de gracia. `deleteAccount` ya existe: revisar que borre de verdad y no
  solo marque `deletedAt`.
- Base legal de los leads entrantes: el consentimiento lo recoge el formulario de
  Meta de tu cliente, pero conviene dejarlo por escrito en el DPA.

**Terminado cuando:** los textos los ha revisado un abogado de SaaS/RGPD, no una
plantilla de internet.

---

## Fase 5 — Operación del VPS · ~2 días

> **Estado: fase completa.** `Caddyfile` con TLS automático, servicio `caddy` en
> el compose, la app **deja de publicar el puerto 3000** (solo se llega por
> Caddy), workflow `release.yml` que publica la imagen en GHCR al etiquetar
> `v*`, y `RUNBOOK.md` con despliegue, vuelta atrás, diagnóstico, rotación de
> secretos y umbrales de escalado.
>
> **Queda por hacer en el servidor** (no es código): contratar el VPS, apuntar el
> DNS, rellenar `.env.local` y correr el primer despliegue siguiendo el runbook.

- **Reverse proxy** delante del contenedor: Caddy (TLS automático, config de tres
  líneas) o Traefik.
- **Despliegue**: CI construye y publica la imagen al taggear; en el VPS,
  `docker compose --profile app up -d`. Con una sola instancia habrá unos
  segundos de corte en cada despliegue: es aceptable, pero documéntalo.
- Rotación de logs, firewall (solo 80/443/22), fail2ban en SSH.
- **Runbook** escrito: qué hacer si la app no responde, cómo restaurar un backup,
  cómo rotar cada secreto, a quién avisar.

**Terminado cuando:** despliegas desde cero en un VPS limpio siguiendo solo el
runbook, en menos de 30 minutos.

---

## Fase 6 — Deuda consciente (después del primer cliente)

Nada de esto bloquea el lanzamiento con una instancia, pero conviene tenerlo
anotado y no olvidado:

- **Driver S3** para `lib/storage/` y mover las imágenes en data URL (logos,
  avatares) al storage. Obligatorio antes de una segunda instancia; recomendable
  antes si el disco crece.
- **Rate limit compartido** (colección Mongo con TTL, sin infra nueva). Solo hace
  falta al pasar de una instancia.
- **Responsive móvil**: la tabla necesita su versión en tarjetas.
- **A11y**: roles `grid/row/gridcell` en tabla y kanban.
- **i18n**: hoy cubre el chrome del sidebar; el resto es extracción progresiva.
- **MANY_TO_MANY** por UI.
- **OAuth de Gmail/Outlook** y recepción entrante de WhatsApp/IMAP.

---

## Resumen y ruta crítica

| Fase                 | Duración           | Bloquea el lanzamiento       |
| -------------------- | ------------------ | ---------------------------- |
| 0 · Red de seguridad | 1-2 días           | Sí                           |
| 1 · Cuentas          | 4-6 días           | Sí                           |
| 2 · Endurecimiento   | 2-3 días           | Sí                           |
| 3 · Stripe           | 5-8 días           | Sí (cobras desde el día uno) |
| 4 · Legal            | 2-3 días + abogado | Sí                           |
| 5 · Operación        | 2 días             | Sí                           |
| 6 · Deuda            | —                  | No                           |

**Total: ~4-6 semanas** de una persona, más el ida y vuelta con el abogado, que
conviene arrancar pronto porque no depende de ti.

Las fases 3 y 4 pueden solaparse. Las fases 0, 1, 2 y 5 son secuenciales en la
práctica, porque cada una asume la anterior.

## Lo que NO hay que hacer todavía

- Migrar a Kubernetes o a varias réplicas. Un VPS aguanta mucho más de lo que la
  gente supone, y multiplicar instancias te obliga a resolver storage, rate limit
  y despliegue sin corte antes de tener un solo cliente que lo pague.
- Integración nativa con Meta (sin Zapier). El App Review son semanas y Zapier ya
  cubre el caso; hazlo cuando un cliente lo pida por precio o por volumen.
- Optimizar consultas antes de tener datos reales. Los índices actuales están
  pensados; mide con producción antes de tocarlos.
