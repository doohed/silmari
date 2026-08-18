import Link from 'next/link';
import { BrandMark } from '@/components/ui/BrandMark';
import { LEGAL, legalIsDraft } from '@/lib/config/legal';

const PAGES = [
  { href: '/legal/aviso-legal', label: 'Aviso legal' },
  { href: '/legal/privacidad', label: 'Privacidad' },
  { href: '/legal/terminos', label: 'Términos' },
  { href: '/legal/cookies', label: 'Cookies' },
];

/** Shell de las páginas legales: públicas, sobrias y enlazadas entre sí. */
export default function LegalLayout({ children }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <Link href="/welcome" className="mb-8 inline-block">
        <BrandMark size={36} />
      </Link>

      {legalIsDraft() && (
        <p className="border-border bg-chip-yellow text-primary mb-8 rounded-lg border px-3 py-2 text-xs">
          <strong>Borrador sin revisar.</strong> Faltan datos por rellenar en{' '}
          <code>lib/config/legal.js</code> y estos textos no los ha validado un abogado. No
          publiques el servicio en este estado.
        </p>
      )}

      <article className="legal-prose text-secondary text-sm leading-relaxed">{children}</article>

      <nav className="border-border mt-12 flex flex-wrap gap-x-4 gap-y-2 border-t pt-6 text-xs">
        {PAGES.map((p) => (
          <Link key={p.href} href={p.href} className="text-tertiary hover:text-primary">
            {p.label}
          </Link>
        ))}
      </nav>
      <p className="text-tertiary mt-4 text-xs">Última actualización: {LEGAL.lastUpdated}</p>
    </div>
  );
}
