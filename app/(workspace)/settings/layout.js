import { requireContext } from '@/lib/auth/dal';
import { NavItem } from '@/components/layout/NavItem';

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
  return (
    <div className="flex h-full">
      <aside className="border-border bg-sunken/60 w-56 shrink-0 overflow-y-auto border-r p-3">
        <p className="text-primary mb-2 px-2 text-[15px] font-semibold tracking-tight">Ajustes</p>
        <nav>
          {GROUPS.map((g) => (
            <div key={g.title} className="mb-3 last:mb-0">
              <p className="text-tertiary px-2 pb-1 text-[11px] font-medium tracking-wider uppercase">
                {g.title}
              </p>
              <div className="space-y-px">
                {g.items.map((s) => (
                  <NavItem key={s.href} href={s.href} label={s.label} icon={s.icon} />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
