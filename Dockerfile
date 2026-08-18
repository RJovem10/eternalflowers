# ╔══════════════════════════════════════════════════════════════════╗
# ║  Dockerfile — Eternal Flowers (Next.js + Payload, PostgreSQL)   ║
# ║  Multi-stage build: deps → build → runtime (non-root)          ║
# ╚══════════════════════════════════════════════════════════════════╝

# ────────── Stage 1: Dependencies ──────────
FROM node:22-alpine AS deps

WORKDIR /app

# Copy only dependency manifests for layer caching
COPY package.json package-lock.json* ./
COPY scripts/patch-load-env.js scripts/patch-load-env.js

# Install ALL dependencies (devDependencies needed for build)
RUN npm ci

# ────────── Stage 2: Build ──────────
FROM node:22-alpine AS build

WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# NEXT_PUBLIC_* variáveis públicas: necessárias DURANTE o build porque
# são incorporadas no bundle JavaScript (client components) e usadas
# em server components durante pré-renderização (metadata, etc.).
# Apenas variáveis públicas (pk_*) — NUNCA secrets server-side.
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

ARG NEXT_PUBLIC_SERVER_URL
ENV NEXT_PUBLIC_SERVER_URL=$NEXT_PUBLIC_SERVER_URL

# Generate Payload types (not git-versioned) before building
# NODE_ENV=development evita guards de DB/secret production
# sem DATABASE_URI nem PAYLOAD_SECRET reais.
ENV NODE_ENV=development
RUN npm run generate:types

# Build the Next.js + Payload application
# NODE_ENV=production é definido por razões históricas (next build usa-o internamente)
# mas o guard de DB em produção é desactivado durante build via NEXT_PHASE.
ENV NODE_ENV=production
RUN npm run build

# Prune devDependencies for smaller runtime
RUN npm prune --omit=dev

# ────────── Stage 3: Runtime ──────────
FROM node:22-alpine AS runner

# Create non-root user for runtime security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy built artifacts and production deps from build stage
COPY --from=build /app/.next          ./.next
COPY --from=build /app/public         ./public
COPY --from=build /app/node_modules   ./node_modules
COPY --from=build /app/package.json   ./
COPY --from=build /app/next.config.js ./
COPY --from=build /app/tsconfig.json  ./
COPY --from=build /app/src            ./src
COPY --from=build /app/scripts        ./scripts
COPY --from=build /app/vitest.config.ts ./
COPY --from=build /app/postcss.config.mjs ./
COPY --from=build /app/tailwind.config.mjs ./

# Copy migrations (needed at runtime for migration scripts)
COPY --from=build /app/src/migrations     ./src/migrations
COPY --from=build /app/src/migrations-pg  ./src/migrations-pg

# Copy translations (needed at runtime for bootstrap-canonical.mjs locale data)
COPY --from=build /app/translations ./translations

# Ensure media directory exists and has correct ownership
RUN mkdir -p /app/media && chown -R appuser:appgroup /app

# Security: run as non-root user
USER appuser

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "run", "start"]