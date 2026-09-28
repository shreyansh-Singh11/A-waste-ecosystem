# ==============================================================================
# CirculaSync / EcoTrack 360 — Production Dockerfile
# Multi-Stream Circular Economy & Statutory Compliance Platform
# ==============================================================================

FROM node:20-alpine AS base

# Install openssl for Prisma engine compatibility on Alpine
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Copy dependency specifications & Prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies and generate Prisma client
RUN npm install
RUN npx prisma generate

# Copy source code, engines, portals & data stores
COPY . .

# Set default production environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose standard application port
EXPOSE 3000

# Healthcheck to verify Express API responsiveness
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/stats || exit 1

# Launch CirculaSync Unified Server
CMD ["node", "server.js"]
