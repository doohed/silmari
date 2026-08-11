import { subscribe } from '@/lib/events/bus';
import { runAutomationsForEvent } from '@/lib/automations/engine';

/**
 * Suscriptor del motor de automatizaciones. Reacciona a los eventos de registro
 * y delega en el motor, que casa disparador + condiciones y ejecuta las acciones.
 * Fire-and-forget como todos los suscriptores; el motor lleva su propio guard
 * anti-bucles por profundidad.
 */
subscribe('automations', (ctx, event) => {
  if (event?.type !== 'record.created' && event?.type !== 'record.updated') return;
  return runAutomationsForEvent(ctx, event);
});
