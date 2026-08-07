import Link from 'next/link';

export const metadata = { title: 'No encontrado · Silmari' };

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="text-center">
        <p className="text-tertiary font-mono text-xs tracking-widest uppercase">Error 404</p>
        <h1 className="text-primary mt-2 text-2xl font-semibold tracking-tight">
          Página no encontrada
        </h1>
        <p className="text-secondary mt-2 text-sm">
          La página que buscas no existe o se ha movido.
        </p>
        <Link
          href="/"
          className="border-border bg-surface text-primary hover:border-border-strong mt-6 inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium transition-colors"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
