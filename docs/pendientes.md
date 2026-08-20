# Pendientes

Lista operativa de **qué queda por hacer**, a 20/08/2026. Una sola lista para no
tener que reconstruirla leyendo tres documentos.

El **porqué** de cada cosa no está aquí, está en su sitio: las fases de
lanzamiento en [`plan-produccion.md`](./plan-produccion.md), los hallazgos de
seguridad en [`plan-seguridad.md`](./plan-seguridad.md), los procedimientos de
servidor en [`runbook.md`](./runbook.md) y el **backlog de producto** en
`CLAUDE.md` § _Pendientes conocidos_ (MANY_TO_MANY, ROLLUP, a11y, responsive de
la ficha y el kanban, i18n, OAuth de Gmail/Outlook, recepción entrante…). Esta
lista no los duplica.

---

## 1. Bloquean abrir el servicio

- [ ] **Rellenar los datos de la empresa** en `lib/config/legal.js`. Quedan 8
      marcadores (`[[RAZÓN SOCIAL]]`, `[[CIF]]`, `[[DIRECCIÓN POSTAL COMPLETA]]`,
      `[[DATOS REGISTRALES]]`, los dos correos, `[[FECHA]]`, `[[PAÍS / REGIÓN]]`).
      Mientras haya uno, `legalIsDraft()` da `true` y las cuatro páginas
      `/legal/*` salen con el aviso de borrador. **No se puede cobrar en la UE con
      los términos y la política de privacidad sin rellenar**, y el RGPD exige
      identificar al responsable del tratamiento. La parte técnica ya está hecha;
      esto es rellenar y que lo revise tu abogado.

- [ ] **Confirmar que el backup automático corre** (`scripts/backup.mjs` + cron en
      el host, a almacenamiento externo, retención 30 días).

- [ ] **Hacer el ensayo de restauración**: restaurar el volcado de ayer y arrancar
      la app contra él. De todo lo que hay en este documento, un backup que nunca
      se ha probado es lo que más caro sale. Procedimiento en el runbook.

- [ ] **Cerrar Stripe de punta a punta**: crear productos y precios en el panel,
      poner `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO` y
      `STRIPE_PRICE_BUSINESS`, activar **Stripe Tax** (IVA obligatorio vendiendo
      en la UE) y probar el ciclo completo con tarjetas de prueba reenviando los
      eventos con `stripe listen`. El código está; falta la configuración y la
      prueba real.

- [ ] **Dar de alta el dominio en Resend** y poner `RESEND_API_KEY` y `MAIL_FROM`.
      Sin ellas el driver `console` escribe el enlace en el log: en local vale, en
      producción significa que nadie recibe la invitación ni el enlace de
      recuperación.

## 2. Antes de que la URL sea pública

- [ ] **Aplicar el `limit_req` de nginx** en el servidor. La configuración y los
      valores están escritos en el runbook; falta ponerlos y recargar. Es lo único
      que corta una avalancha antes de que llegue a Node.

- [ ] **Decidir si va un CDN delante** (Cloudflare o equivalente, modo proxy).
      ⚠️ Si lo pones: `set_real_ip_from` con sus rangos y
      `real_ip_header CF-Connecting-IP`, o `X-Forwarded-For` pasa a ser la del CDN
      y **todos** los frenos por IP —los de nginx y los de la app— colapsan en un
      único cliente. Es la forma más silenciosa de desactivar todo lo montado.

- [ ] **Monitor externo de uptime** sobre `/api/health` con aviso al móvil. Sin
      rastreador de errores (descartado por decisión), es lo único que avisa de
      que hay algo que mirar.

- [ ] **Comprobar las cabeceras en el dominio real** (securityheaders.com). En el
      build de producción salen las seis y los scripts llevan nonce; falta
      verificarlo servido de verdad, con nginx delante.

## 3. Una sola vez, al desplegar

- [ ] **Correr `scripts/clean-form-redirect-urls.mjs`** una vez por entorno. Pone a
      `null` los `redirectUrl` de formularios que no sean http(s). Idempotente.

- [ ] **Reiniciar el proceso al desplegar la Fase 1 de seguridad.** Cambió el
      esquema de `User` (`sessionsValidFrom`) y Mongoose conserva el compilado
      anterior en caliente.

- [ ] Recordar que el **primer despliegue en producción cierra las sesiones
      abiertas**: la cookie pasa a llevar el prefijo `__Host-` y el nombre se
      decide en build. Es esperado, no un fallo.

## 4. Decisiones que dependen de ti

- [ ] **Lista blanca de puertos de los webhooks** (`80, 443, 8080, 8443` en
      `lib/http/safe-url.js`). Si algún cliente autoaloja su receptor en otro
      puerto —n8n en `:5678`, por ejemplo—, no podrá usarlo. El control que de
      verdad importa es el bloqueo de IPs internas, no esto: quitarla es un `Set`
      de una línea.

- [ ] **`members:changeRole` existe como permiso pero no hay servicio que lo
      implemente** (`lib/auth/permissions.js:25`). O se implementa —y entonces
      lleva su `logSecurityEvent('member.roleChanged', …)`— o se quita la clave
      para que no parezca que hay algo que no hay.

## 5. Deuda consciente (no bloquea)

- [ ] **Freno en las server actions** (`consumeRateLimit` dentro del `withCtx` de
      cada archivo de acciones) y en **`/api/files/[id]`**. Higiene, no
      protección: los endpoints caros ya lo llevan.

- [ ] **Rate limit compartido entre instancias.** Hoy vive en memoria del proceso,
      que es correcto con **una** instancia. El día que haya una segunda réplica,
      el cupo efectivo se multiplica por réplica y hay que moverlo a un almacén
      compartido. Lo mismo vale para el storage de adjuntos en disco local.

- [ ] **Detección de tipo por bytes mágicos** en las subidas, en vez de fiarse del
      MIME que declara el cliente. El daño está cortado aguas abajo (`nosniff` +
      `Content-Disposition: attachment`), así que es mejora, no corrección.

- [ ] **Quitar `unsafe-inline` de `style-src`.** Exige sacar a variables CSS los
      `style` calculados en runtime (anchos de columna, posiciones del kanban).
      Es refactor de UI, y el riesgo que cubre es marginal teniendo `script-src`
      con nonce.

---

## Revisado y descartado a propósito

Para que no se reabran en cada repaso. El razonamiento completo, en
`plan-seguridad.md` § _Lo que se deja como está_ y en `CLAUDE.md`.

| Tema                           | Por qué se deja                                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Banner de cookies              | Solo hay cookies necesarias o de preferencia y ninguna analítica de terceros; añadir una obligaría a consentimiento previo. |
| Rastreador de errores (Sentry) | El diagnóstico se hace leyendo los logs del servidor, preparados para eso.                                                  |
| Host SMTP arbitrario           | Es la función: apuntarlo a la red interna no devuelve nada al atacante y hay quien tiene servidor propio.                   |
| `/api/health` sin autenticar   | Hace un `ping` a Mongo, que es justo lo que un monitor externo necesita.                                                    |
