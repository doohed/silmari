import { z } from 'zod';

const email = z.email({ error: 'Introduce un email válido' }).trim().toLowerCase();

const password = z
  .string()
  .min(8, { error: 'La contraseña debe tener al menos 8 caracteres' })
  .regex(/[a-zA-Z]/, { error: 'Debe contener al menos una letra' })
  .regex(/[0-9]/, { error: 'Debe contener al menos un número' });

const firstName = z
  .string()
  .trim()
  .min(1, { error: 'Introduce tu nombre' })
  .max(80, { error: 'El nombre es demasiado largo' });

const lastName = z.string().trim().max(80, { error: 'El apellido es demasiado largo' }).default('');

/** Alta por email desde la puerta de entrada: solo email + contraseña. */
export const emailSignupSchema = z.object({ email, password });

/** Cambiar/establecer contraseña. `currentPassword` se exige en el servicio si aplica. */
export const changePasswordSchema = z.object({
  currentPassword: z.string().optional().default(''),
  newPassword: password,
});

/** Alta: crea usuario + workspace. */
export const signupSchema = z.object({
  firstName,
  lastName,
  email,
  password,
  workspaceName: z
    .string()
    .trim()
    .min(1, { error: 'Ponle un nombre a tu espacio de trabajo' })
    .max(80, { error: 'El nombre es demasiado largo' }),
});

/** Inicio de sesión. */
export const loginSchema = z.object({
  email,
  password: z.string().min(1, { error: 'Introduce tu contraseña' }),
});

/** Pedir el enlace de restablecimiento. */
export const forgotPasswordSchema = z.object({ email });

/** Establecer la contraseña nueva desde el enlace del correo. */
export const resetPasswordSchema = z.object({
  token: z.string().min(1, { error: 'Enlace no válido' }),
  password,
});

/** Invitar a un miembro al workspace. */
export const inviteSchema = z.object({
  email,
  role: z.enum(['ADMIN', 'MEMBER'], { error: 'Rol no válido' }).default('MEMBER'),
});

/** Aceptar una invitación creando la cuenta. */
export const acceptInviteSchema = z.object({
  firstName,
  lastName,
  password,
});
