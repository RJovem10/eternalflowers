FROM node:22-alpine

# Create non-root user and group for runtime security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY package.json package-lock.json* ./
COPY scripts/patch-load-env.js scripts/patch-load-env.js
RUN npm install

COPY . .
RUN npm run build

# Ensure runtime directories have correct ownership
RUN mkdir -p /app/media && chown -R appuser:appgroup /app

# Security: run as non-root user
USER appuser

EXPOSE 3000

CMD ["npm", "run", "start"]