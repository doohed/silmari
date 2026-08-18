# Runbook de operación

Qué hacer cuando algo va mal en producción. Se irá completando en la Fase 5 de
`PLAN-PRODUCCION.md`; hoy cubre backup y recuperación.

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

## Pendiente de escribir (Fase 5)

- Procedimiento de despliegue y de vuelta atrás.
- Qué mirar cuando la app no responde (contenedor, Mongo, disco, memoria).
- Rotación de cada secreto, con su efecto colateral.
- Escalado del VPS y umbrales para plantearse una segunda instancia.
