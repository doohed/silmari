import { BrandMark } from '@/components/ui/BrandMark';

/**
 * Shell de las páginas de autenticación: tarjeta centrada sobre el fondo de app.
 */
export default function AuthLayout({ children }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="anim-fade-up w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2.5 text-center">
          <BrandMark size={32} />
          <p className="text-primary text-sm font-semibold tracking-tight">Silmari</p>
        </div>
        <div className="border-border bg-surface rounded-xl border p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
