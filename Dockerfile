# Flynn AI Telephony Server - Fly.io Dockerfile
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install production dependencies only.
# --ignore-scripts skips the `postinstall` hook, which patches react-native-iap
# Kotlin files for the Android build — irrelevant on the server and would fail
# here because scripts/postinstall.js isn't copied into this image.
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY llmClient.js ./

# Copy application code
COPY server.js ./
COPY secureApiRoutes.js ./
COPY supabaseMcpClient.js ./
COPY routes/ ./routes/
COPY telephony/ ./telephony/
COPY middleware/ ./middleware/
COPY notifications/ ./notifications/
COPY services/ ./services/

# Expose port (Fly.io will set PORT env var)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start server
CMD ["node", "server.js"]
