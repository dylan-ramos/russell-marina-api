# syntax=docker/dockerfile:1

FROM node:22-alpine AS development

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]

FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.test.json ./
COPY src ./src
COPY test ./test
COPY data ./data
COPY views ./views
COPY public ./public

RUN npm run build

FROM node:22-alpine AS production

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/data ./data
COPY --from=build --chown=node:node /app/views ./views
COPY --from=build --chown=node:node /app/public ./public

USER node

EXPOSE 3000

CMD ["npm", "start"]
