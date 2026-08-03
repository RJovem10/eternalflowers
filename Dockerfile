FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY scripts/patch-load-env.js scripts/patch-load-env.js
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000

# Security: run as non-root user (node user exists in node:22-alpine)
USER node

CMD ["npm", "run", "start"]