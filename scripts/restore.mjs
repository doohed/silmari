/**
 * Restaura un backup generado por `scripts/backup.mjs`.
 *
 * Uso:
 *   node scripts/restore.mjs ./backups/silmari-2026-08-17T03-00-00.archive.gz
 *
 * Variables de entorno:
 *   RESTORE_URI   destino de la restauración (obligatoria).
 *                 NO se usa MONGODB_URI a propósito: así un despiste no
 *                 sobrescribe producción con un backup viejo.
 *   RESTORE_DROP  'true' para borrar las colecciones antes de restaurar.
 *
 * Pensado para el ensayo periódico de recuperación: restaura en una base local
 * y arranca la app contra ella. Ver docs/runbook.md.
 */

import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

const archive = process.argv[2];
const uri = process.env.RESTORE_URI;
const drop = process.env.RESTORE_DROP === 'true';

if (!archive) {
  console.error('Uso: node scripts/restore.mjs <archivo.archive.gz>');
  process.exit(1);
}

if (!uri) {
  console.error(
    'Falta RESTORE_URI (destino de la restauración).\n' +
      'Se pide aparte de MONGODB_URI para que sea imposible restaurar sobre producción por descuido.',
  );
  process.exit(1);
}

if (/mongodb\+srv|prod|production/i.test(uri) && process.env.RESTORE_CONFIRM !== 'si') {
  console.error(
    'RESTORE_URI parece apuntar a un entorno remoto o de producción.\n' +
      'Si es intencionado, repite con RESTORE_CONFIRM=si',
  );
  process.exit(1);
}

const path = resolve(archive);
await access(path).catch(() => {
  console.error(`No existe el archivo ${path}`);
  process.exit(1);
});

const args = [`--uri=${uri}`, `--archive=${path}`, '--gzip'];
if (drop) args.push('--drop');

console.log(`Restaurando ${path}`);
console.log(`Destino: ${uri}${drop ? ' (borrando colecciones existentes)' : ''}`);

const child = spawn('mongorestore', args, { stdio: 'inherit' });
child.on('error', (err) => {
  console.error('No se pudo ejecutar mongorestore:', err.message);
  process.exit(1);
});
child.on('close', (code) => {
  if (code !== 0) {
    console.error(`mongorestore salió con código ${code}`);
    process.exit(code);
  }
  console.log(
    '\nRestauración completada. Arranca la app contra esta base y comprueba que ' +
      'puedes entrar y ver los registros: un backup sin verificar no cuenta.',
  );
});
