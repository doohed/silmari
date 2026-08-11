import { describe, it, expect } from 'vitest';
import { renderTemplate, extractVariables } from '@/lib/templates/render';

describe('renderTemplate', () => {
  it('sustituye variables por su valor', () => {
    expect(renderTemplate('Hola {{name}}', { name: 'Ana' })).toBe('Hola Ana');
  });

  it('admite espacios y puntos en el nombre de variable', () => {
    expect(renderTemplate('De {{ actor.name }}', { 'actor.name': 'Leo' })).toBe('De Leo');
  });

  it('reemplaza variables ausentes o nulas por cadena vacía (sin dejar el literal)', () => {
    expect(renderTemplate('Hola {{name}}!', {})).toBe('Hola !');
    expect(renderTemplate('Hola {{name}}!', { name: null })).toBe('Hola !');
  });

  it('sustituye todas las apariciones', () => {
    expect(renderTemplate('{{x}}-{{x}}', { x: '7' })).toBe('7-7');
  });

  it('tolera texto vacío o nulo', () => {
    expect(renderTemplate('', { x: '1' })).toBe('');
    expect(renderTemplate(null, {})).toBe('');
  });
});

describe('extractVariables', () => {
  it('devuelve los nombres únicos en orden de aparición', () => {
    expect(extractVariables('Hola {{name}}, {{email}} y {{name}}')).toEqual(['name', 'email']);
  });

  it('sin variables → lista vacía', () => {
    expect(extractVariables('texto plano')).toEqual([]);
  });
});
