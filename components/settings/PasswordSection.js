'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { FormError } from '@/components/ui/FormError';
import { changePasswordAction } from '@/app/(workspace)/settings/actions';

/**
 * Cambiar (o establecer, en cuentas OAuth) la contraseña.
 * @param {{ hasPassword: boolean }} props
 */
export function PasswordSection({ hasPassword }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  async function save(e) {
    e.preventDefault();
    setErrors({});
    if (next !== confirm) {
      setErrors({ confirm: 'Las contraseñas no coinciden' });
      return;
    }
    setSaving(true);
    const r = await changePasswordAction({ currentPassword: current, newPassword: next });
    setSaving(false);
    if (r.ok) {
      toast.success(hasPassword ? 'Contraseña actualizada' : 'Contraseña establecida');
      setCurrent('');
      setNext('');
      setConfirm('');
      return;
    }
    if (r.fieldErrors) {
      setErrors({
        current: r.fieldErrors.currentPassword?.[0],
        next: r.fieldErrors.newPassword?.[0],
      });
    } else {
      toast.error(r.message);
    }
  }

  return (
    <form onSubmit={save} className="max-w-md space-y-4">
      {hasPassword && (
        <div>
          <Label htmlFor="currentPassword">Contraseña actual</Label>
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <FormError message={errors.current} />
        </div>
      )}
      {!hasPassword && (
        <p className="text-secondary text-xs">
          Tu cuenta accede con Google. Puedes establecer también una contraseña.
        </p>
      )}
      <div>
        <Label htmlFor="newPassword">Nueva contraseña</Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <FormError message={errors.next} />
      </div>
      <div>
        <Label htmlFor="confirmPassword">Repite la contraseña</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <FormError message={errors.confirm} />
      </div>
      <Button type="submit" variant="secondary" disabled={saving || !next}>
        {saving ? 'Guardando…' : hasPassword ? 'Cambiar contraseña' : 'Establecer contraseña'}
      </Button>
    </form>
  );
}

export default PasswordSection;
