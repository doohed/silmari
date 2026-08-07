import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils/cn';

describe('humo: entorno de tests', () => {
  it('resuelve el alias @ y ejecuta código de lib', () => {
    // twMerge debe quedarse con la última clase en conflicto.
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-fg', false && 'hidden')).toBe('text-fg');
  });
});
