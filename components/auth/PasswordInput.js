'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Campo de contraseña con toggle de visibilidad. El icono vive dentro del campo
 * gracias a un contenedor flex (sin posicionamiento absoluto). Reenvía `ref` y el
 * resto de props al `<input>`, así funciona tanto controlado como con
 * `register()` de React Hook Form.
 * @param {object} props
 * @param {string} [props.className]
 */
export function PasswordInput({ ref, className, ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className="border-border bg-surface focus-within:border-accent focus-within:ring-accent/15 flex h-11 items-center rounded-xl border pr-3 transition-[border-color,box-shadow] duration-150 focus-within:ring-2">
      <input
        ref={ref}
        type={show ? 'text' : 'password'}
        className={cn(
          'text-primary placeholder:text-tertiary h-full flex-1 rounded-xl bg-transparent px-4 text-sm outline-none',
          className,
        )}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="text-tertiary hover:text-secondary flex shrink-0 items-center"
        aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export default PasswordInput;
