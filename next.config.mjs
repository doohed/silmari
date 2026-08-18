import { STATIC_SECURITY_HEADERS } from './lib/http/security-headers.js';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Empaqueta el servidor + solo las dependencias usadas en `.next/standalone`,
  // para una imagen Docker mínima que arranca con `node server.js`.
  output: 'standalone',

  /**
   * Cabeceras de seguridad estáticas para todas las rutas. La CSP no está aquí:
   * lleva un nonce por respuesta y se emite desde `proxy.js`.
   */
  async headers() {
    return [{ source: '/:path*', headers: STATIC_SECURITY_HEADERS }];
  },
};

export default nextConfig;
