import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db/connect';

/**
 * Migración: pasa el responsable único `assigneeId` a la lista `assigneeIds`
 * (varios responsables por tarea). Idempotente. Uso:
 *   MONGODB_URI=... node --no-warnings --loader ./scripts/alias-loader.mjs \
 *     scripts/migrate-task-assignees.mjs
 */
await connectToDatabase();
const coll = mongoose.connection.collection('activities');
const r1 = await coll.updateMany({ assigneeId: { $ne: null } }, [
  { $set: { assigneeIds: ['$assigneeId'] } },
]);
const r2 = await coll.updateMany({ assigneeId: { $exists: true } }, { $unset: { assigneeId: '' } });
console.log(
  'assigneeIds poblados:',
  r1.modifiedCount,
  '| assigneeId eliminado de:',
  r2.modifiedCount,
);
await mongoose.disconnect();
