import { beforeAll, beforeEach, afterAll, inject } from 'vitest';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db/connect';

// URI del mongodb-memory-server arrancado en global-setup (se lee en tiempo de
// llamada en connect.js, así que basta con fijar la env antes de conectar).
beforeAll(() => {
  process.env.MONGODB_URI = inject('mongoUri');
  process.env.AUTH_SECRET = 'test-secret-solo-para-tests';
});

// Limpia todas las colecciones antes de cada test para aislarlos.
beforeEach(async () => {
  await connectToDatabase();
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));

  // Elimina los índices dinámicos (data.<campo>) para que no se acumulen entre
  // tests. En una BD fresca la colección puede no existir todavía.
  const records = mongoose.connection.collection('records');
  const indexes = await records.indexes().catch(() => []);
  await Promise.all(
    indexes
      .filter((i) => i.name?.startsWith('fld_'))
      .map((i) => records.dropIndex(i.name).catch(() => {})),
  );
});

afterAll(async () => {
  await mongoose.disconnect();
});
