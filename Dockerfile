# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Install dependencies only (layer cached unless package.json changes)
COPY package*.json ./
RUN npm ci --omit=dev

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Copy deps from previous stage
COPY --from=deps /app/node_modules ./node_modules

# Copy app source
COPY server.js    ./
COPY public/      ./public/

# The data/ folder is NOT copied — it is mounted as a volume at runtime
# so that candidate JSON files and CV files persist on the host machine.

# Expose the app port
EXPOSE 3000

# Run as non-root for security
USER node

CMD ["node", "server.js"]
