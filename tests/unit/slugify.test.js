import { describe, it, expect } from 'vitest';
import { slugify } from '@/lib/utils/slugify';

describe('slugify', () => {
  it('normaliza espacios y mayúsculas', () => {
    expect(slugify('Mi Empresa')).toBe('mi-empresa');
  });

  it('quita acentos y caracteres no válidos', () => {
    expect(slugify('Acción & Café')).toBe('accion-cafe');
  });

  it('recorta guiones sobrantes', () => {
    expect(slugify('  --Hola--  ')).toBe('hola');
  });
});
