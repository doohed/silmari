/**
 * Borrado definitivo de lo que lleva suficiente tiempo en la papelera.
 *
 * La app usa borrado lógico en todas partes (`deletedAt`), que es lo correcto
 * para poder deshacer, pero **no basta para el RGPD**: el derecho de supresión
 * exige que los datos acaben desapareciendo de verdad. Este script cierra ese
 * hueco y debe correr a diario, junto al backup.
 *
 * Uso:
 *   MONGODB_URI="..." node --no-warnings --loader ./scripts/alias-loader.mjs \
 *     scripts/purge-deleted.mjs [--dias=30] [--dry-run]
 *
 * `--dry-run` cuenta lo que borraría sin tocar nada. Úsalo la primera vez.
 *
 * OJO: los backups siguen conteniendo los datos purgados hasta que caduquen por
 * retención. Está bien mientras el plazo de retención sea razonable y esté
 * documentado en la política de privacidad; no lo está si prometes borrado
 * inmediato.
 */

import mongoose from 'mongoose';
import Activity from '@/models/Activity';
import Attachment from '@/models/Attachment';
import FieldMetadata from '@/models/FieldMetadata';
import ObjectMetadata from '@/models/ObjectMetadata';
import Record from '@/models/Record';
import RecordRelation from '@/models/RecordRelation';
import TimelineActivity from '@/models/TimelineActivity';
import User from '@/models/User';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const diasArg = args.find((a) => a.startsWith('--dias='));
const days = Number(diasArg?.split('=')[1] ?? 30);

if (!Number.isFinite(days) || days < 1) {
  console.error('--dias debe ser un número mayor o igual que 1');
  process.exit(1);
}
if (!process.env.MONGODB_URI) {
  console.error('Falta MONGODB_URI');
  process.exit(1);
}

const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

await mongoose.connect(process.env.MONGODB_URI);
console.log(`Purgando lo borrado antes de ${cutoff.toISOString()}${dryRun ? ' (simulación)' : ''}`);

/** Colecciones con borrado lógico propio: se purgan por su `deletedAt`. */
const SOFT_DELETED = [
  ['actividades', Activity],
  ['adjuntos', Attachment],
  ['campos', FieldMetadata],
  ['objetos', ObjectMetadata],
];

let total = 0;

// Los registros van primero y aparte: sus relaciones y su historial NO tienen
// `deletedAt` propio (cuelgan del registro), así que hay que borrarlos por su
// id. Purgarlos por `deletedAt` no habría borrado nada y habría parecido hecho.
const staleRecords = await Record.find({ deletedAt: { $ne: null, $lt: cutoff } })
  .select('_id')
  .lean();
const recordIds = staleRecords.map((r) => r._id);

if (recordIds.length > 0) {
  const relationFilter = {
    $or: [{ sourceRecordId: { $in: recordIds } }, { targetRecordId: { $in: recordIds } }],
  };
  const relations = await RecordRelation.countDocuments(relationFilter);
  const timeline = await TimelineActivity.countDocuments({ recordId: { $in: recordIds } });

  if (!dryRun) {
    await RecordRelation.deleteMany(relationFilter);
    await TimelineActivity.deleteMany({ recordId: { $in: recordIds } });
    await Record.deleteMany({ _id: { $in: recordIds } });
  }
  total += recordIds.length + relations + timeline;
  const verbo = dryRun ? 'se borrarían' : 'borrados';
  console.log(`  · registros: ${recordIds.length} ${verbo}`);
  console.log(`  · relaciones colgando de ellos: ${relations} ${verbo}`);
  console.log(`  · eventos de historial: ${timeline} ${verbo}`);
} else {
  console.log('  · registros: nada que purgar');
}

for (const [label, Model] of SOFT_DELETED) {
  const filter = { deletedAt: { $ne: null, $lt: cutoff } };
  const count = await Model.countDocuments(filter);
  if (count === 0) {
    console.log(`  · ${label}: nada que purgar`);
    continue;
  }
  if (!dryRun) await Model.deleteMany(filter);
  total += count;
  console.log(`  · ${label}: ${count} ${dryRun ? 'se borrarían' : 'borrados'}`);
}

// Las cuentas van al final: al borrarlas se pierde el vínculo con su contenido.
const userFilter = { deletedAt: { $ne: null, $lt: cutoff } };
const users = await User.countDocuments(userFilter);
if (users > 0) {
  if (!dryRun) await User.deleteMany(userFilter);
  total += users;
  console.log(`  · cuentas: ${users} ${dryRun ? 'se borrarían' : 'borradas'}`);
}

console.log(`\nTotal: ${total} documentos${dryRun ? ' (no se ha tocado nada)' : ' eliminados'}`);
if (!dryRun && total > 0) {
  console.log('Recuerda: los backups anteriores siguen conteniendo estos datos.');
}

await mongoose.disconnect();
