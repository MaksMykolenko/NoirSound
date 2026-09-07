# Frontend production image: build the Vite SPA, serve it with Caddy which also
# reverse-proxies /api to the backend. Built static files live in /srv.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# In production the SPA talks to the API same-origin via Caddy at /api.
ARG VITE_API_BASE_URL=/api
ARG VITE_USE_MOCK_API=false
ARG VITE_PUBLIC_APP_ENABLED=false
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_USE_MOCK_API=${VITE_USE_MOCK_API}
ENV VITE_PUBLIC_APP_ENABLED=${VITE_PUBLIC_APP_ENABLED}
RUN npm run build

FROM caddy:2-alpine
ARG GIT_SHA=unknown
ARG BUILD_DATE=unknown
LABEL org.opencontainers.image.revision=$GIT_SHA \
      org.opencontainers.image.created=$BUILD_DATE \
      org.opencontainers.image.source="https://github.com/MaksMykolenko/NoirSound"
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
EXPOSE 80 443
