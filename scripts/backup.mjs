/**
 * Backup de MongoDB a un archivo comprimido, con purga por retención y subida
 * opcional a almacenamiento externo.
 *
 * Uso:
 *   node scripts/backup.mjs
 *
 * Variables de entorno:
 *   MONGODB_URI             (obligatoria) cadena de conexión
 *   BACKUP_DIR              carpeta destino (por defecto ./backups)
 *   BACKUP_RETENTION_DAYS   días que se conservan en local (por defecto 30)
 *   BACKUP_UPLOAD_CMD       comando de subida; se le añade la ruta del archivo.
 *                           P. ej.  rclone copy   o   aws s3 cp --  … s3://bucket/
 *
 * Se apoya en `mongodump`, que viene con mongodb-database-tools. Deliberadamente
 * no usa el SDK de ningún proveedor: la subida se delega en un comando externo
 * para no atarse a S3, R2 o Backblaze.
 *
 * Un backup que no se ha restaurado nunca no es un backup: ver `scripts/restore.mjs`
 * y el apartado de recuperación de docs/runbook.md.
 */

import { spawn } from 'node:child_process';
import { mkdir, readdir, stat, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const uri = process.env.MONGODB_URI;
const dir = resolve(process.env.BACKUP_DIR || './backups');
const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS || 30);
const uploadCmd = process.env.BACKUP_UPLOAD_CMD;

if (!uri) {
  console.error('Falta MONGODB_URI');
  process.exit(1);
}

/** Ejecuta un comando heredando la salida; resuelve con el código de salida. */
function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolvePromise() : reject(new Error(`${command} salió con código ${code}`)),
    );
  });
}

/** Marca temporal ordenable y válida como nombre de fichero: 2026-08-17T19-30-00. */
function stamp() {
  return new Date().toISOString().slice(0, 19).replace(/:/g, '-');
}

/** Borra los archivos de backup más antiguos que la retención configurada. */
async function prune() {
  const limit = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const files = await readdir(dir).catch(() => []);
  let removed = 0;
  for (const file of files) {
    if (!file.startsWith('silmari-') || !file.endsWith('.gz')) continue;
    const path = join(dir, file);
    const info = await stat(path);
    if (info.mtimeMs < limit) {
      await unlink(path);
      removed += 1;
    }
  }
  if (removed) console.log(`Purgados ${removed} backups anteriores a ${retentionDays} días`);
}

async function main() {
  await mkdir(dir, { recursive: true });
  const archive = join(dir, `silmari-${stamp()}.archive.gz`);

  console.log(`Volcando la base de datos en ${archive}…`);
  await run('mongodump', [`--uri=${uri}`, `--archive=${archive}`, '--gzip']);

  const { size } = await stat(archive);
  console.log(`Backup completado: ${(size / 1024 / 1024).toFixed(1)} MB`);

  if (uploadCmd) {
    console.log('Subiendo a almacenamiento externo…');
    const [command, ...args] = uploadCmd.split(' ').filter(Boolean);
    await run(command, [...args, archive]);
    console.log('Subida completada');
  } else {
    console.warn(
      'BACKUP_UPLOAD_CMD no está definida: el backup solo existe en este servidor. ' +
        'Un backup en la misma máquina que la base de datos no protege de perder la máquina.',
    );
  }

  await prune();
}

main().catch((err) => {
  console.error('El backup ha fallado:', err.message);
  process.exit(1);
});
