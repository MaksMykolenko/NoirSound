FROM node:22-alpine

RUN apk add --no-cache dumb-init ffmpeg

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN npx prisma generate

COPY src ./src/

# NOTE: dev deps are intentionally kept so the container can run
# `prisma migrate deploy` at startup (the Prisma CLI is a dev dependency).
# If you prefer a leaner runtime image, run migrations from a separate
# one-shot job and add `RUN npm prune --omit=dev` here.

ENV NODE_ENV=production
EXPOSE 3000

USER node
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]
