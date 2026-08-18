'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';

/** Tipo de <input> según el tipo de campo del CRM (mejora la UX móvil). */
function inputType(fieldType) {
  if (fieldType === 'EMAILS') return 'email';
  if (fieldType === 'PHONES') return 'tel';
  if (fieldType === 'NUMBER' || fieldType === 'CURRENCY' || fieldType === 'PERCENT')
    return 'number';
  return 'text';
}

/**
 * Renderiza y envía un formulario web público. Hace POST a `/api/forms/<slug>`
 * con `{ values, _hp }` (honeypot oculto anti-spam). Al terminar muestra el
 * mensaje de éxito o redirige si el formulario define `redirectUrl`.
 */
export function PublicFormRenderer({ form }) {
  const [values, setValues] = useState({});
  const [hp, setHp] = useState(''); // honeypot: debe quedar vacío
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  function setField(name, value) {
    setValues((v) => ({ ...v, [name]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      const res = await fetch(`/api/forms/${form.slug}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ values, _hp: hp }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error?.message || json?.message || 'No se pudo enviar el formulario');
        return;
      }
      if (form.redirectUrl) {
        window.location.href = form.redirectUrl;
        return;
      }
      setDone(true);
    } catch {
      setError('No se pudo enviar el formulario. Revisa tu conexión.');
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="border-border bg-surface rounded-xl border p-8 text-center shadow-sm">
        <p className="text-primary text-base font-medium">{form.successMessage}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="border-border bg-surface space-y-4 rounded-xl border p-6 shadow-sm"
    >
      <h1 className="text-primary text-lg font-semibold tracking-tight">{form.name}</h1>

      {form.fields.map((f) => (
        <div key={f.fieldName}>
          <Label htmlFor={f.fieldName}>
            {f.label}
            {f.required && <span className="text-danger"> *</span>}
          </Label>
          <Input
            id={f.fieldName}
            type={inputType(f.type)}
            required={f.required}
            placeholder={f.placeholder}
            value={values[f.fieldName] ?? ''}
            onChange={(e) => setField(f.fieldName, e.target.value)}
          />
        </div>
      ))}

      {/* Honeypot: oculto para personas, tentador para bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          No rellenar
          <input
            tabIndex={-1}
            autoComplete="off"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
          />
        </label>
      </div>

      {error && <p className="text-danger text-sm">{error}</p>}

      <Button type="submit" disabled={sending} className="w-full">
        {sending ? 'Enviando…' : form.submitLabel}
      </Button>
    </form>
  );
}

export default PublicFormRenderer;
