/**
 * Marco visual común de un paso del onboarding: título, subtítulo y contenido,
 * centrado y con entrada suave. Presentacional (sin estado).
 * @param {{ title: string, subtitle?: string, children: React.ReactNode }} props
 */
export function StepFrame({ title, subtitle, children }) {
  return (
    <div className="anim-fade-up mx-auto w-full max-w-md">
      <h1 className="text-primary text-3xl font-semibold tracking-tight">{title}</h1>
      {subtitle && <p className="text-secondary mt-2 text-sm">{subtitle}</p>}
      <div className="mt-10">{children}</div>
    </div>
  );
}

export default StepFrame;
