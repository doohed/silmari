/**
 * Shell de las páginas de autenticación: tarjeta centrada sobre el fondo de app.
 */
export default function AuthLayout({ children }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="anim-fade-up w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-primary text-xl font-semibold tracking-tight">Silmari</p>
        </div>
        <div className="border-border bg-surface rounded-2xl border p-7 shadow-lg">{children}</div>
      </div>
    </div>
  );
}
