FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json ./
RUN npm install --omit=dev

FROM base AS final
COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 3003
USER node
CMD ["node", "src/index.js"]
