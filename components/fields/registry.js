'use client';

import { textTypes, TextDisplay, TextEdit } from './text-fields';
import { numberTypes } from './number-fields';
import { boolDateTypes } from './bool-date-fields';
import { choiceTypes } from './choice-fields';
import { compositeTypes } from './composite-fields';
import { relationTypes } from './relation-fields';
import { actorTypes } from './actor-fields';
import { memberTypes } from './member-fields';

const REGISTRY = {
  ...textTypes,
  ...numberTypes,
  ...boolDateTypes,
  ...choiceTypes,
  ...compositeTypes,
  ...relationTypes,
  ...actorTypes,
  ...memberTypes,
};

/** Fallback de texto para tipos sin componente dedicado. */
const FALLBACK = { Display: TextDisplay, Edit: TextEdit };

/**
 * Componentes { Display, Edit } de un tipo de campo. Edit puede ser undefined
 * (campo no editable inline). Un tipo puede aportar además `toText(value, field)`
 * para representarse en texto plano (exportación CSV) cuando el
 * `toSearchText` del registry de servidor no sirve para mostrarlo.
 * @param {string} type
 */
export function getFieldComponents(type) {
  return REGISTRY[type] ?? FALLBACK;
}
