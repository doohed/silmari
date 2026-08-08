# syntax=docker/dockerfile:1

# Imagen de producción de la app Next (Silmari) en varias etapas.
# La app se sirve desde el output `standalone` (ver next.config.mjs): un servidor
# mínimo con solo las dependencias necesarias. Node 24 = misma major que en local.

# --- deps: instala dependencias con la lockfile ---
FROM node:24-alpine AS deps
# libc6-compat: algunos binarios nativos esperan glibc en Alpine.
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- builder: compila la app ---
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variables NEXT_PUBLIC_*: se incrustan en el bundle EN BUILD, no en runtime.
# Se pasan como build args (con los mismos valores por defecto que .env.example).
# Overríbelas desde el compose o con `--build-arg` si cambias de dominio.
ARG NEXT_PUBLIC_APP_URL="http://localhost:3000"
ARG NEXT_PUBLIC_APP_DOMAIN="silmari.app"
ARG NEXT_PUBLIC_APP_NAME="Silmari"
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_APP_DOMAIN=$NEXT_PUBLIC_APP_DOMAIN \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# --- runner: imagen final, sin toolchain de build ---
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Usuario sin privilegios.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Assets estáticos y el servidor standalone (incluye node_modules podados).
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Carpeta de subidas (STORAGE_DIR=./storage); se monta un volumen encima.
RUN mkdir -p storage && chown -R nextjs:nodejs storage

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
