import mongoose from 'mongoose';

/**
 * Usuario global (no pertenece a un workspace; se relaciona vía WorkspaceMember).
 * @typedef {'WORKSPACE'|'PROFILE'|'INVITE'|'PLAN'|'WELCOME'|'DONE'} OnboardingStep
 * @typedef {object} UserDoc
 * @property {string} email
 * @property {string} [passwordHash] Ausente en cuentas OAuth (Google).
 * @property {'email'|'google'} authProvider
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} [avatarUrl]
 * @property {Date} [emailVerifiedAt] Null mientras no se confirma la dirección.
 * @property {OnboardingStep} onboardingStep
 * @property {Date} [lastActiveAt]
 * @property {Date} [sessionsValidFrom] Corte de validez de las sesiones emitidas.
 */

const ONBOARDING_STEPS = ['WORKSPACE', 'PROFILE', 'INVITE', 'PLAN', 'WELCOME', 'DONE'];

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Opcional: las cuentas OAuth (Google) no tienen contraseña.
    passwordHash: { type: String, default: null },
    authProvider: { type: String, enum: ['email', 'google', 'microsoft'], default: 'email' },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, default: '', trim: true },
    avatarUrl: { type: String, default: null },
    // Fecha en que se confirmó la dirección. Null = sin confirmar. Las cuentas
    // OAuth y las creadas al aceptar una invitación nacen confirmadas: en ambos
    // casos ya se ha demostrado el control del buzón.
    emailVerifiedAt: { type: Date, default: null },
    // Paso del onboarding. Default DONE para no atrapar cuentas ya existentes
    // ni las creadas por invitación; el alta nueva lo pone en WORKSPACE.
    onboardingStep: { type: String, enum: ONBOARDING_STEPS, default: 'DONE' },
    lastActiveAt: { type: Date, default: null },
    // Corte de validez de las sesiones: todo JWT emitido ANTES de esta fecha
    // deja de valer (lo comprueba `lib/auth/dal.js`). Se adelanta al cambiar o
    // restablecer la contraseña, que es el momento en que hay que echar al que
    // pudiera tener la cuenta tomada. Null = sin cortes, vale cualquier sesión.
    sessionsValidFrom: { type: Date, default: null },
    // Soft delete de la cuenta (danger zone). Las guardas de auth la rechazan.
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const ONBOARDING_STEP_ORDER = ONBOARDING_STEPS;
export const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
