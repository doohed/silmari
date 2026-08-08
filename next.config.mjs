/** @type {import('next').NextConfig} */
const nextConfig = {
  // Empaqueta el servidor + solo las dependencias usadas en `.next/standalone`,
  // para una imagen Docker mínima que arranca con `node server.js`.
  output: 'standalone',
};

export default nextConfig;
