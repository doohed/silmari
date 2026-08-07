'use client';

import { Chip } from './Chip';
import { Avatar } from '@/components/ui/Avatar';

/**
 * Origen no humano de un registro. "Sistema" cubre lo que crea la propia app sin
 * un usuario detrás (semilla, datos demo); "API" queda listo para la integración
 * externa. Cuando hay un usuario real, "Creado por" muestra su nombre y avatar.
 */
const SOURCES = {
  API: { label: 'API', color: 'purple' },
  SYSTEM: { label: 'Sistema', color: 'gray' },
};

/** ¿El valor ACTOR corresponde a una persona (usuario real, no Sistema/API)? */
function isPerson(value) {
  return Boolean(value?.userId) && value.source !== 'SYSTEM' && value.source !== 'API';
}

/**
 * Etiqueta visible de un valor ACTOR (también para exportar a CSV): el nombre de
 * la persona si lo creó un usuario, o el origen ("Sistema"/"API") si no.
 * @param {{ source?: string, userId?: string, name?: string }} [value]
 * @returns {string}
 */
export function actorSourceLabel(value) {
  if (isPerson(value) && value.name) return value.name;
  return (SOURCES[value?.source] ?? SOURCES.SYSTEM).label;
}

/** Solo lectura: lo escribe el servidor al crear el registro (y se hidrata). */
function ActorDisplay({ value }) {
  if (isPerson(value) && value.name) {
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <Avatar name={value.name} src={value.avatarUrl} size={18} />
        <span className="truncate">{value.name}</span>
      </span>
    );
  }
  const source = SOURCES[value?.source] ?? SOURCES.SYSTEM;
  return <Chip label={source.label} color={source.color} />;
}

export const actorTypes = {
  ACTOR: { Display: ActorDisplay, toText: actorSourceLabel },
};
