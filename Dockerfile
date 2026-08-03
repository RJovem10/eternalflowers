FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY scripts/patch-load-env.js scripts/patch-load-env.js
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]