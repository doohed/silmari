# Runbook de operación

Cómo se despliega Silmari y qué hacer cuando algo va mal. Escrito para poder
seguirlo a las tres de la mañana sin pensar.

Arquitectura de producción: **nginx en el host** (TLS con certbot) → **app**
(Next en `standalone`, en Docker) → **Mongo** (Docker, replica set de un nodo),
con una sola instancia de la app.

El contenedor de la app publica el 3000 **solo en `127.0.0.1`**, así que nginx
llega por loopback y desde internet no se puede tocar saltándose el TLS.

---

## Backup

`scripts/backup.mjs` vuelca la base con `mongodump` a un archivo comprimido,
purga los antiguos y, si se lo indicas, lo sube fuera del servidor.

### Requisitos

`mongodump` y `mongorestore` vienen en **mongodb-database-tools**, que se instala
aparte del servidor de Mongo:

```bash
# Debian/Ubuntu
sudo apt-get install -y mongodb-database-tools
# macOS
brew install mongodb/brew/mongodb-database-tools
```

### Variables

| Variable                | Por defecto | Para qué                                           |
| ----------------------- | ----------- | -------------------------------------------------- |
| `MONGODB_URI`           | —           | Base de origen (obligatoria)                       |
| `BACKUP_DIR`            | `./backups` | Carpeta destino                                    |
| `BACKUP_RETENTION_DAYS` | `30`        | Días que se conservan en local                     |
| `BACKUP_UPLOAD_CMD`     | —           | Comando de subida; se le añade la ruta del archivo |

### Ejecución manual

```bash
npm run backup
```

### Cron diario en el VPS

```cron
# Backup a las 03:00, log aparte para poder revisarlo.
0 3 * * * cd /srv/silmari && BACKUP_UPLOAD_CMD="rclone copy" /usr/bin/npm run backup >> /var/log/silmari-backup.log 2>&1
```

> **Un backup guardado en la misma máquina que la base de datos no protege de
> perder la máquina.** Configura `BACKUP_UPLOAD_CMD` contra R2, S3 o Backblaze.
> Sin esa variable el script te avisa, pero no falla.

---

## Recuperación

`scripts/restore.mjs` restaura un archivo generado por el script anterior.

El destino se toma de **`RESTORE_URI`**, nunca de `MONGODB_URI`. Es a propósito:
así ningún despiste puede sobrescribir producción con un backup viejo. Si la URI
parece remota o de producción, el script se planta salvo que añadas
`RESTORE_CONFIRM=si`.

```bash
RESTORE_URI="mongodb://localhost:27017/silmari-restore?replicaSet=rs0" \
RESTORE_DROP=true \
npm run restore -- ./backups/silmari-2026-08-17T03-00-00.archive.gz
```

### Ensayo de recuperación (hazlo cada trimestre)

Un backup que nunca se ha restaurado no es un backup. El ensayo completo:

1. Descarga el backup **de ayer** desde el almacenamiento externo, no uno local.
2. Levanta un Mongo limpio: `npm run db:up`.
3. Restaura en una base **distinta** de la de desarrollo (`silmari-restore`).
4. Arranca la app apuntando ahí:
   ```bash
   MONGODB_URI="mongodb://localhost:27017/silmari-restore?replicaSet=rs0" npm run dev
   ```
5. Comprueba a mano: entras con una cuenta real, ves los registros, abres una
   ficha y el timeline tiene historial.
6. Anota la fecha del ensayo y cuánto has tardado de punta a punta. Ese tiempo es
   tu RTO real, y es el número que le darás a un cliente cuando pregunte.

### Qué NO recupera el backup

- Los **adjuntos**, que viven en disco (`STORAGE_DIR`, volumen `app-storage` del
  compose). Necesitan su propia copia mientras el storage sea local.
- Las **variables de entorno** y secretos (`.env.local`). Guárdalos en un gestor
  de contraseñas: sin `AUTH_SECRET` la base restaurada es inservible, porque de
  él se derivan las sesiones y el cifrado de los secretos de integraciones.

---

## Rotar `INTEGRATIONS_SECRET`

Los secretos de integraciones (contraseña SMTP, token de WhatsApp) se cifran con
`INTEGRATIONS_SECRET`. Si no está definida se usa `AUTH_SECRET`, por
compatibilidad con instalaciones anteriores a la separación.

Para migrar de `AUTH_SECRET` a una variable propia, o para rotar la que ya hay:

```bash
npm run backup            # primero, siempre

OLD_SECRET="<el secreto con el que se cifró>" \
NEW_SECRET="<el nuevo>" \
MONGODB_URI="..." \
node --no-warnings --loader ./scripts/alias-loader.mjs scripts/rotate-integration-secret.mjs
```

Después actualiza `INTEGRATIONS_SECRET` en el entorno **antes** de reiniciar la
app. Los documentos que no se puedan descifrar con `OLD_SECRET` se dejan
intactos y se cuentan aparte, así que repetir el script tras un fallo a medias no
rompe nada.

> Rotar `AUTH_SECRET` cierra todas las sesiones. Eso es esperado. Lo que **no**
> debe pasar es que además deje ilegibles los secretos de integraciones: por eso
> están separados.

---

## Borrado definitivo (RGPD)

La app borra en lógico (`deletedAt`) para poder deshacer, pero el derecho de
supresión exige que los datos acaben desapareciendo. `scripts/purge-deleted.mjs`
elimina de verdad lo que lleva más de 30 días en la papelera.

```bash
# Primero en simulación, para ver qué se llevaría por delante.
MONGODB_URI="..." npm run purge -- --dry-run

# Y en el cron diario, junto al backup.
0 4 * * * cd /srv/silmari && /usr/bin/npm run purge >> /var/log/silmari-purge.log 2>&1
```

Los registros se purgan junto con sus **relaciones y su historial**, que no
tienen `deletedAt` propio y cuelgan del registro por id.

> Los backups anteriores siguen conteniendo los datos purgados hasta que caduquen
> por retención (30 días). Es admisible si el plazo está documentado en la
> política de privacidad; no lo es si prometes borrado inmediato.

---

## Primer despliegue en un VPS limpio

Objetivo: menos de 30 minutos siguiendo solo esta sección.

1. **Servidor.** Cualquier VPS con 2 vCPU y 4 GB llega de sobra para empezar.
   Instala Docker y el plugin de compose. Crea un usuario sin privilegios y
   deshabilita el acceso SSH por contraseña.

2. **Firewall.** Solo tres puertos abiertos:

   ```bash
   ufw default deny incoming && ufw default allow outgoing
   ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
   ufw enable
   ```

   Mongo (27017) **no** se publica: vive en la red interna de compose. La app
   publica el 3000 pero atado a `127.0.0.1`, así que solo la alcanza nginx desde
   la propia máquina.

3. **DNS.** Un registro `A` del dominio apuntando a la IP del VPS. Hazlo antes
   de pedir el certificado: sin DNS resuelto, Let's Encrypt no puede validarlo.

4. **Código y secretos.**

   ```bash
   git clone <repo> /srv/silmari && cd /srv/silmari
   cp .env.example .env.local
   ```

   Rellena `.env.local`. Los que **no pueden faltar**: `AUTH_SECRET`,
   `INTEGRATIONS_SECRET`, `APP_URL`, `RESEND_API_KEY`, `MAIL_FROM` y las cuatro
   de Stripe. Genera los secretos con `openssl rand -base64 32` y
   guárdalos también en tu gestor de contraseñas: **sin `AUTH_SECRET` un backup
   restaurado es inservible.**

5. **Arrancar la app.**

   ```bash
   docker compose --profile app up -d --build
   curl -sS localhost:3000/api/health   # debe responder por loopback
   ```

6. **nginx y el certificado.** Ver la sección siguiente.

7. **Comprobar.** `https://tudominio/api/health` responde 200, puedes registrarte
   y te llega el correo de confirmación.

8. **Cron.** Backup y purga diarios (ver arriba).

> **La imagen queda atada al dominio.** `NEXT_PUBLIC_APP_URL` se incrusta en el
> build, no se lee en runtime. Si cambias de dominio hay que **reconstruir**;
> reiniciar no basta. Si te la dejas en `localhost`, los enlaces de invitación y
> de recuperación de contraseña saldrán apuntando a localhost en los correos.

---

## nginx y el certificado

nginx vive **en el host**, no en Docker: así certbot puede recargarlo sin
coordinar contenedores, que es donde ese montaje se complica.

```bash
apt-get install -y nginx certbot python3-certbot-nginx
```

`/etc/nginx/sites-available/silmari`:

Las dos zonas de `limit_req` van **fuera** del bloque `server`, en el contexto
`http` (`/etc/nginx/nginx.conf`, o en un archivo de `conf.d/`): una zona es
global y no se puede declarar dentro de un `server`.

```nginx
# Contexto http. 10 MB de zona son ~160.000 IPs en seguimiento, de sobra.
limit_req_zone $binary_remote_addr zone=silmari_general:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=silmari_auth:10m    rate=1r/s;
limit_req_status 429;
```

```nginx
server {
    listen 80;
    server_name tudominio.com;

    location / {
        # Freno de fuerza bruta a nivel de proxy. Esto es lo único que sirve
        # ante una avalancha: los contadores de la app viven DENTRO del proceso
        # de Node, así que para que se miren, la petición ya ha llegado hasta
        # ahí. Aquí se corta antes.
        #
        # `burst` permite la ráfaga normal de un navegador (una página del App
        # Router pide decenas de recursos a la vez) y `nodelay` la sirve sin
        # encolarla; lo que se corta es el ritmo sostenido.
        limit_req zone=silmari_general burst=60 nodelay;

        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # CRÍTICO: $remote_addr, NO $proxy_add_x_forwarded_for. El segundo
        # AÑADE la cabecera que mandó el cliente en vez de reemplazarla, así que
        # cualquiera podría falsificar su IP y saltarse el freno por IP de
        # `lib/auth/throttle.js`. Es el error más común de esta configuración.
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $host;

        # Streaming de React Server Components: sin esto la respuesta se
        # bufferea y la navegación se siente lenta.
        proxy_buffering off;
    }

    # Las rutas de credenciales van mucho más apretadas: aquí nadie navega, se
    # envía un formulario. Duplica el freno por email/IP de
    # `lib/auth/throttle.js`, a propósito: ese vive en memoria del proceso y se
    # reinicia con cada despliegue, este no.
    location ~ ^/(login|signup|forgot|reset|invite) {
        limit_req zone=silmari_auth burst=10 nodelay;

        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $host;
        proxy_buffering off;
    }

    # Por defecto nginx corta en 1 MB y los adjuntos fallarían con un 413.
    # 12 MB = los 10 del límite de la app más el margen del multipart.
    client_max_body_size 12M;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
}
```

**No añadas cabeceras de seguridad aquí.** Las pone la app: las estáticas en
`next.config.mjs` y la CSP con su nonce en `proxy.js`. Duplicarlas deja dos
valores en la respuesta y, en el caso de la CSP, una sin nonce pisando a la buena.

### Hasta dónde llega esto, y hasta dónde no

Conviene tener clara la diferencia, porque las dos cosas se llaman igual:

- **Abuso** — alguien con cuenta o con API key raspando datos, machacando un
  endpoint caro o probando contraseñas. Lo para la **aplicación**: el freno por
  API key de `/api/v1`, el de los formularios públicos, el de subidas, el de
  `/api/export` (3 por hora, es el endpoint más caro que hay) y
  `lib/auth/throttle.js`.
- **Avalancha** — miles de peticiones por segundo, con o sin cuenta. **No la para
  la aplicación**: para que un contador en memoria de Node se mire, la petición
  ya ha atravesado la red, nginx y el arranque de la petición en el servidor. Lo
  que la para es lo de arriba, `limit_req`, y por delante un CDN.

**Cuándo hace falta un CDN delante** (Cloudflare o equivalente, modo proxy): en
cuanto el dominio sea público y haya clientes de pago. Un `limit_req` protege
frente a un script suelto, no frente a un ataque distribuido ni frente a la
saturación del ancho de banda del VPS — eso se corta antes de llegar a tu
máquina o no se corta. Si lo pones, revisa que siga llegando la IP real: con
Cloudflare hay que añadir `set_real_ip_from` con sus rangos y
`real_ip_header CF-Connecting-IP`, o `X-Forwarded-For` pasará a ser la del CDN y
todos los frenos por IP contarán como si fuera un solo cliente.

Comprobar que el freno está puesto y no molesta:

```bash
nginx -t && systemctl reload nginx
# 30 peticiones seguidas: deben responder 200; ninguna 429.
for i in $(seq 30); do curl -s -o /dev/null -w "%{http_code} " https://tudominio.com/; done
# El log de nginx registra cada corte, con la zona que lo hizo.
grep 'limiting requests' /var/log/nginx/error.log | tail
```

Si aparecen 429 en la navegación normal, sube el `burst` antes que el `rate`: la
ráfaga es lo propio de un navegador, el ritmo sostenido es lo que delata a un
script.

Activar y pedir el certificado:

```bash
ln -s /etc/nginx/sites-available/silmari /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d tudominio.com
```

`certbot --nginx` reescribe el bloque para añadir el 443, el certificado y la
redirección desde HTTP. A partir de ahí:

```bash
systemctl status certbot.timer   # la renovación automática ya viene puesta
certbot renew --dry-run          # confirma que renovará sin intervención
```

> El **puerto 80 tiene que seguir abierto** aunque todo el tráfico vaya por
> HTTPS: certbot lo necesita para validar en cada renovación. Y comprueba el
> `--dry-run` al menos una vez; el fallo clásico es que el certificado se renueva
> pero nginx no se recarga y sigue sirviendo el viejo hasta que alguien lo nota,
> 90 días después.

---

## Desplegar una versión nueva

CI publica la imagen al crear una etiqueta `v*` (`.github/workflows/release.yml`).
En el servidor:

```bash
cd /srv/silmari
npm run backup                 # siempre antes de tocar nada
git pull                       # trae el compose actualizado
docker compose --profile app pull
docker compose --profile app up -d
docker compose logs -f app
```

Con una sola instancia hay **unos segundos de corte** mientras el contenedor se
reemplaza. Es asumible; si algún día no lo es, hará falta una segunda réplica y,
con ella, storage en S3 y rate limit compartido.

### Volver atrás

```bash
docker compose --profile app down
# Fija la etiqueta anterior en el compose (o `docker tag` a mano) y levanta.
docker compose --profile app up -d
```

Volver a una versión anterior **no deshace las migraciones de datos**. Si la
versión nueva ejecutó un script de `scripts/`, revisa si es reversible antes de
retroceder; si no lo es, restaura el backup.

---

## La app no responde

En este orden, que va de lo más probable a lo más raro:

```bash
docker compose --profile app ps          # ¿están vivos los contenedores?
docker compose --profile app logs --tail=100 app
journalctl -u nginx --no-pager -n 50    # el proxy vive en el host
df -h                                    # ¿disco lleno? (logs, backups, storage)
free -m                                  # ¿se lo comió el OOM killer?
docker stats --no-stream
curl -sS localhost/api/health            # 503 = la app vive pero Mongo no
```

Interpretación rápida:

- **503 en `/api/health`**: la app está levantada pero no llega a Mongo. Mira el
  contenedor `mongo` y que el replica set esté iniciado.
- **502 desde nginx**: la app no responde. Casi siempre es un arranque fallido
  por una variable de entorno que falta; sale en los logs de `app`. Confirma con
  `curl localhost:3000/api/health` desde el propio servidor.
- **413 al subir un adjunto**: falta `client_max_body_size` en nginx (por defecto
  son 1 MB).
- **Certificado caducado**: `certbot renew --dry-run` y revisa que el puerto 80
  siga abierto; se necesita para renovar, no solo el 443.
- **Disco lleno**: los sospechosos son `/var/log/nginx`, los backups locales y
  `app-storage`. Los adjuntos crecen sin tope: es el aviso de que toca S3.

---

## Leer los logs

No hay rastreador de errores externo: el diagnóstico se hace leyendo los logs del
servidor. Están pensados para eso — **un evento por línea**, con marca de tiempo
propia y el contexto serializado compacto, para que `grep` funcione.

```bash
# En vivo, solo la app.
docker compose --profile app logs -f app

# Últimas 200 líneas de todo, con la marca de tiempo de Docker.
docker compose --profile app logs -t --tail=200

# Solo errores.
docker compose --profile app logs --tail=1000 app | grep '\[error\]'

# Rastrear a un usuario o workspace concreto por un incidente.
docker compose --profile app logs --tail=5000 app | grep '<workspaceId>'

# Desde una hora concreta.
docker compose --profile app logs --since 2026-08-17T09:00:00 app
```

En producción el nivel por defecto es `info`, así que se ven las altas, los
correos enviados, los cobros procesados y los leads entrantes. Para bajar el
ruido temporalmente, `LOG_LEVEL=warn` en `.env.local` y `up -d`. Para depurar
algo concreto, `LOG_LEVEL=debug`, pero **no lo dejes puesto**: crece rápido.

Los logs de Docker están **limitados a 20 MB × 5 ficheros por servicio**. Sin ese
tope, el driver por defecto crece sin límite hasta llenar el disco, que es la
avería más habitual en un VPS de una sola máquina. Los de nginx los rota
`logrotate` del sistema, que en Debian/Ubuntu viene configurado de serie.

> Este es el punto flaco de no tener rastreador de errores: si no entras a
> mirar, no te enteras. El monitor externo de uptime sobre `/api/health` es lo
> que te avisa de que hay algo que mirar; con logs a mano, es imprescindible.

---

## Rotar secretos

Cada uno tiene su efecto colateral. Ninguno es indoloro.

| Secreto                 | Efecto al rotarlo                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| `AUTH_SECRET`           | Cierra **todas** las sesiones. Los usuarios vuelven a entrar.                                              |
| `INTEGRATIONS_SECRET`   | Deja ilegibles los secretos de integraciones si no ejecutas antes `scripts/rotate-integration-secret.mjs`. |
| `RESEND_API_KEY`        | Sin efecto para los usuarios; los correos en vuelo pueden fallar.                                          |
| `STRIPE_SECRET_KEY`     | El Checkout y el portal dejan de funcionar hasta reiniciar.                                                |
| `STRIPE_WEBHOOK_SECRET` | Los webhooks empiezan a rechazarse con 400. Cámbialo en el panel de Stripe y en el `.env.local` a la vez.  |

Tras cambiar cualquiera: `docker compose --profile app up -d` para que el
contenedor recoja el entorno nuevo.

> `AUTH_SECRET` e `INTEGRATIONS_SECRET` están separados precisamente para poder
> rotar el primero sin arrastrar el segundo. No los vuelvas a unificar.

---

## Cuándo dejará de bastar una instancia

Señales para plantearse la segunda réplica, por orden de aparición:

- El corte de unos segundos en cada despliegue empieza a molestar a clientes.
- `app-storage` crece hasta hacer incómodo el backup del disco → toca **driver S3**.
- La memoria del contenedor roza el límite de forma sostenida.
- Necesitas despliegues sin corte o tolerancia a fallo del nodo.

Antes de la segunda instancia hay **tres deudas que dejan de ser opcionales**:
storage en S3, rate limit compartido (hoy en memoria por proceso) y despliegue
sin corte. Están recogidas en la Fase 6 de [`plan-produccion.md`](./plan-produccion.md).
