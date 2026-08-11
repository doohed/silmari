import { requireContext } from '@/lib/auth/dal';
import { NavItem } from '@/components/layout/NavItem';

const SECTIONS = [
  { href: '/settings/profile', label: 'Perfil' },
  { href: '/settings/workspace', label: 'Espacio de trabajo' },
  { href: '/settings/members', label: 'Miembros' },
  { href: '/settings/data-model', label: 'Modelo de datos' },
  { href: '/settings/api-keys', label: 'API keys' },
  { href: '/settings/webhooks', label: 'Webhooks' },
  { href: '/settings/automations', label: 'Automatizaciones' },
  { href: '/settings/templates', label: 'Plantillas' },
  { href: '/settings/leads', label: 'Entrada de leads' },
];

export default async function SettingsLayout({ children }) {
  await requireContext();
  return (
    <div className="flex h-full">
      <aside className="border-border w-56 shrink-0 border-r p-3">
        <p className="text-tertiary mb-1 px-2 py-1.5 text-[11px] font-medium tracking-wider uppercase">
          Ajustes
        </p>
        <nav className="space-y-0.5">
          {SECTIONS.map((s) => (
            <NavItem key={s.href} href={s.href} label={s.label} icon="Circle" />
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
