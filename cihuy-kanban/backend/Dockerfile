FROM node:20-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY src ./src
COPY .env.example ./.env.example

RUN mkdir -p /app/data

EXPOSE 3012
CMD ["sh", "-c", "[ -f .env ] || cp .env.example .env; pnpm run init-db && pnpm run start"]
