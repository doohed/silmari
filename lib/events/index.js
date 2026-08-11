/**
 * Punto de entrada del bus de eventos. Importar desde aquí garantiza que los
 * suscriptores integrados quedan registrados antes del primer `emitDomainEvent`
 * (los imports con efectos secundarios de abajo se ejecutan al cargar el módulo).
 *
 * Para añadir un suscriptor: crea `lib/<área>/subscriber.js` que llame a
 * `subscribe(...)` y añádelo aquí.
 */
import '@/lib/webhooks/subscriber';
import '@/lib/notifications/subscriber';

export { emitDomainEvent } from '@/lib/events/bus';
export { EVENT_TYPES, recordEvent } from '@/lib/events/types';
