# webhype Marketing-Seite (Astro, Node-Standalone) für Coolify/Docker
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund --legacy-peer-deps

# Build
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# PUBLIC_*-Variablen werden von Astro beim Build eingebacken → hier setzen (Coolify überschreibt via Build-Arg).
ARG SITE_URL=https://web-hype.de
ENV SITE_URL=$SITE_URL
ARG PUBLIC_PORTAL_URL=https://mein.web-hype.de/portal
ENV PUBLIC_PORTAL_URL=$PUBLIC_PORTAL_URL
RUN npm run build

# Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321
# Chromium für die PDF-Erzeugung des Website-Check-Reports (lib/checkReport.ts).
# CHROMIUM_IN_DOCKER schaltet --disable-dev-shm-usage ein (Container-/dev/shm ist nur 64 MB).
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates
ENV CHROMIUM_PATH=/usr/bin/chromium-browser
ENV CHROMIUM_IN_DOCKER=1
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]
