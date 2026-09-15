# Multi-Modal Consensus Broker — Telemetry Core Engine
# Infrastructure Deployment — Muhammad Usman
#
# Small, production-lean image for the WebSocket + arbitration + persistence server.

FROM node:22-alpine

# Non-root runtime user for a smaller attack surface.
WORKDIR /app

# Install prod dependencies first for better layer caching.
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source.
COPY . .

ENV NODE_ENV=production \
    PORT=8080

EXPOSE 8080

# Lightweight container healthcheck against the server's /health endpoint.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||8080)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# Drop privileges (the node:alpine image ships a 'node' user).
USER node

CMD ["node", "websocket-server/server.js"]
