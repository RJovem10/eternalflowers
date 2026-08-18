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

# Ensure media directory exists and has correct ownership
RUN mkdir -p /app/media && chown -R appuser:appgroup /app

# Security: run as non-root user
USER appuser

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "run", "start"]