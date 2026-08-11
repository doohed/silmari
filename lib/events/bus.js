import { logger } from '@/lib/utils/logger';

/**
 * Bus de eventos de dominio (en proceso). Único punto desde el que la capa de
 * servicios anuncia lo que ocurre (registro creado/actualizado/borrado, tarea
 * asignada, formulario recibido…). Los suscriptores —webhooks salientes,
 * notificaciones, y en el futuro el motor de automatizaciones— reaccionan sin
 * que el emisor los conozca.
 *
 * Reglas:
 * - **Fire-and-forget**: `emitDomainEvent` nunca bloquea ni hace fallar la
 *   mutación que lo dispara. Un suscriptor que revienta se registra y se ignora.
 * - **Síncrono en proceso** por ahora; este módulo es el seam para mover el
 *   fan-out a una cola (Redis/BullMQ) cuando haga falta, sin tocar a los emisores.
 * - Los suscriptores se registran **por nombre** (Map), así un hot-reload que
 *   reevalúa el wiring reemplaza en vez de duplicar entregas.
 *
 * @typedef {import('@/lib/auth/permissions').Ctx} Ctx
 * @typedef {object} DomainEvent
 * @property {string} type            Tipo canónico, p. ej. 'record.created'.
 * @property {string} [operation]     Operación de webhook, p. ej. 'company.created'.
 * @property {object} [object]        Metadata del objeto afectado ({ id, slug, nameSingular }).
 * @property {any}    [payload]       Datos del evento (DTO del registro, { id }, …).
 * @property {object} [meta]          Extra opcional (diff, actor, …).
 * @typedef {(ctx: Ctx, event: DomainEvent) => (void | Promise<void>)} EventHandler
 */

/** @type {Map<string, EventHandler>} */
const subscribers = new Map();

/**
 * Registra (o reemplaza) un suscriptor bajo un nombre estable.
 * @param {string} name
 * @param {EventHandler} handler
 */
export function subscribe(name, handler) {
  subscribers.set(name, handler);
}

/**
 * Anuncia un evento a todos los suscriptores. No espera a que terminen ni
 * propaga sus errores: cada handler corre aislado y sus fallos solo se loguean.
 * @param {Ctx} ctx
 * @param {DomainEvent} event
 */
export function emitDomainEvent(ctx, event) {
  // Guarda anti-bucles: si el `ctx` viene de una acción de automatización, propaga
  // su profundidad al evento para que el motor pueda cortar cadenas (una regla
  // que actualiza un registro y vuelve a dispararse). Centralizado aquí para no
  // tocar cada servicio emisor.
  const outgoing =
    ctx?._automationDepth != null
      ? { ...event, meta: { ...(event.meta ?? {}), automationDepth: ctx._automationDepth } }
      : event;
  for (const [name, handler] of subscribers) {
    Promise.resolve()
      .then(() => handler(ctx, outgoing))
      .catch((err) => logger.error(`Suscriptor "${name}" falló en evento ${event?.type}`, err));
  }
}

/** Solo para tests: vacía el registro de suscriptores. */
export function _resetSubscribers() {
  subscribers.clear();
}

/** Solo para tests: nombres de los suscriptores registrados. */
export function _subscriberNames() {
  return [...subscribers.keys()];
}
