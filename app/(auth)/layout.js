import { BrandMark } from '@/components/ui/BrandMark';

/**
 * Shell de las páginas de autenticación: columna centrada sin tarjeta, en
 * sintonía con la portada `/welcome`.
 */
export default function AuthLayout({ children }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="anim-fade-up flex w-full max-w-sm flex-col items-center text-center">
        <BrandMark size={52} />
        <div className="mt-10 w-full text-left">{children}</div>
      </div>
    </div>
  );
}
