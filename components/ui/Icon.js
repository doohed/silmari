'use client';

import {
  Building2,
  User,
  Target,
  StickyNote,
  CheckSquare,
  Paperclip,
  Settings,
  Trash2,
  LayoutDashboard,
  Circle,
} from 'lucide-react';

const MAP = {
  Building2,
  User,
  Target,
  StickyNote,
  CheckSquare,
  Paperclip,
  Settings,
  Trash2,
  LayoutDashboard,
  Circle,
};

/**
 * Icono por nombre (de la metadata de objeto). Cae en Circle si no se conoce.
 * @param {{ name?: string, size?: number, className?: string }} props
 */
export function Icon({ name, ...props }) {
  const Cmp = MAP[name] ?? Circle;
  return <Cmp {...props} />;
}

export default Icon;
