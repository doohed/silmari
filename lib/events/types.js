/**
 * Tipos canónicos de eventos de dominio. Constantes compartidas para que
 * emisores y suscriptores no dependan de strings sueltos.
 */
export const EVENT_TYPES = /** @type {const} */ ({
  RECORD_CREATED: 'record.created',
  RECORD_UPDATED: 'record.updated',
  RECORD_DELETED: 'record.deleted',
});

/**
 * Construye el evento canónico de un registro. Centraliza la forma del evento
 * (incluida la `operation` de webhook `${nameSingular}.<verbo>`) para que los
 * tres puntos de emisión de `records/service` no la repitan.
 * @param {'created'|'updated'|'deleted'} verb
 * @param {{ id: string, slug: string, nameSingular: string }} object
 * @param {any} payload
 * @param {object} [meta]
 * @returns {import('@/lib/events/bus').DomainEvent}
 */
export function recordEvent(verb, object, payload, meta) {
  return {
    type: `record.${verb}`,
    operation: `${object.nameSingular}.${verb}`,
    object: { id: object.id, slug: object.slug, nameSingular: object.nameSingular },
    payload,
    ...(meta ? { meta } : {}),
  };
}
