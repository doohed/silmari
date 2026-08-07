import mongoose from 'mongoose';

/**
 * Conexión Mongoose cacheada.
 *
 * En desarrollo, el hot-reload de Next reevalúa los módulos en cada cambio, lo
 * que abriría una conexión nueva por recarga y agotaría el pool. Cacheamos la
 * conexión (y su promesa en vuelo) en `globalThis` para reutilizarla entre
 * recargas y entre invocaciones de route handlers / server actions.
 */

/** @typedef {{ conn: import('mongoose').Mongoose | null, promise: Promise<import('mongoose').Mongoose> | null }} MongooseCache */

/** @type {MongooseCache} */
let cached = globalThis._silmariMongoose;
if (!cached) {
  cached = globalThis._silmariMongoose = { conn: null, promise: null };
}

/**
 * Devuelve la instancia de Mongoose conectada, reutilizando la conexión cacheada.
 * La URI se lee en tiempo de llamada (no al importar) para permitir arranques
 * dinámicos de la BD, p. ej. mongodb-memory-server en tests.
 * @returns {Promise<import('mongoose').Mongoose>}
 */
export async function connectToDatabase() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error('Falta la variable de entorno MONGODB_URI');
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      // Falla rápido en vez de encolar comandos si no hay conexión: evita
      // colgar peticiones cuando la BD no está disponible.
      bufferCommands: false,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    // Permite reintentar en la siguiente llamada si la conexión falló.
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}
