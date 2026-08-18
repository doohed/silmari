import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db/connect';

// Nunca prerenderizar: siempre comprueba la conexión en tiempo de petición.
export const dynamic = 'force-dynamic';

/**
 * Health check: verifica la conexión a MongoDB con un ping.
 * @returns {Promise<Response>}
 */
export async function GET() {
  try {
    await connectToDatabase();
    await mongoose.connection.db.admin().command({ ping: 1 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: 'db_unreachable' }, { status: 503 });
  }
}
