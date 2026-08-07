import { MongoMemoryReplSet } from 'mongodb-memory-server';

/**
 * Arranca un MongoDB efímero como replica set (necesario para transacciones)
 * una vez para toda la suite de integración, y expone su URI a los tests.
 * Sustituye la dependencia de Docker.
 */
export default async function setupMongo({ provide }) {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  provide('mongoUri', replSet.getUri('silmari_test'));
  return async () => {
    await replSet.stop();
  };
}
