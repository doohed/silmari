import { requireContext } from '@/lib/auth/dal';
import { SettingsShell } from '@/components/settings/SettingsShell';

/**
 * Secciones agrupadas por a quién afectan, no por orden de llegada: doce
 * entradas seguidas obligaban a leerlas todas para encontrar una. El icono
 * distingue dentro del grupo y el grupo acota dónde buscar.
 *
 * - **Cuenta**: solo a ti (tu usuario, no el workspace).
 * - **General**: el espacio de trabajo y quién lo paga.
 * - **Datos**: la forma de lo que guardas y lo que se genera con ello.
 * - **Conexiones**: todo lo que habla con sistemas de fuera.
 */
const GROUPS = [
  {
    title: 'Cuenta',
    items: [{ href: '/settings/profile', label: 'Perfil', icon: 'User' }],
  },
  {
    title: 'General',
    items: [
      { href: '/settings/workspace', label: 'Espacio de trabajo', icon: 'Building' },
      { href: '/settings/members', label: 'Miembros', icon: 'Users' },
      { href: '/settings/billing', label: 'Facturación', icon: 'CreditCard' },
    ],
  },
  {
    title: 'Datos',
    items: [
      { href: '/settings/data-model', label: 'Modelo de datos', icon: 'Database' },
      { href: '/settings/templates', label: 'Plantillas', icon: 'ClipboardList' },
      { href: '/settings/forms', label: 'Formularios', icon: 'FileText' },
      { href: '/settings/automations', label: 'Automatizaciones', icon: 'Bot' },
    ],
  },
  {
    title: 'Conexiones',
    items: [
      { href: '/settings/integrations', label: 'Integraciones', icon: 'Puzzle' },
      { href: '/settings/leads', label: 'Entrada de leads', icon: 'Inbox' },
      { href: '/settings/api-keys', label: 'API keys', icon: 'KeyRound' },
      { href: '/settings/webhooks', label: 'Webhooks', icon: 'Webhook' },
    ],
  },
];

export default async function SettingsLayout({ children }) {
  await requireContext();
  return <SettingsShell groups={GROUPS}>{children}</SettingsShell>;
}
