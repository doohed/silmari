/**
 * Topes de las operaciones masivas sobre registros. Módulo puro (sin BD ni
 * Mongoose) para poder compartirlo entre la capa de servicios y el cliente, como
 * ya hace `lib/attachments/limits.js`.
 *
 * No son cifras de producto, son un freno de disponibilidad: cada fila
 * importada abre su propia transacción, así que una llamada con cien mil filas
 * deja ocupada la instancia (una sola, ver `docs/plan-produccion.md`) hasta que
 * termine. Y no hace falta mala fe para llegar ahí: basta un CSV grande de
 * verdad.
 *
 * Se aplican en el **servicio**, no en la UI, porque por ahí pasan también la
 * API pública y las server actions. Lo del cliente es solo un aviso temprano.
 */

/** Filas por archivo importado. */
export const MAX_IMPORT_ROWS = 1000;

/** Registros por operación en lote (borrar o editar la selección). */
export const MAX_BULK_IDS = 500;
