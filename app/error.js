'use client';

export default function Error({ reset }) {
  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="text-center">
        <p className="text-tertiary font-mono text-xs tracking-widest uppercase">Error 500</p>
        <h1 className="text-primary mt-2 text-2xl font-semibold tracking-tight">Algo ha ido mal</h1>
        <p className="text-secondary mt-2 text-sm">
          Ha ocurrido un error inesperado. Puedes reintentar.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="bg-accent text-accent-fg mt-6 inline-flex h-9 items-center rounded-md px-4 text-sm font-medium transition-colors hover:opacity-90"
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}
