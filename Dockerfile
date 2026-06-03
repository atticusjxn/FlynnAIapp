# Flynn AI Telephony Server - Fly.io Dockerfile
# Switched from alpine to slim so Chromium (for puppeteer PDF generation) works.
FROM node:20-slim

# Install Chromium + the libraries puppeteer needs at runtime.
# `--no-install-recommends` keeps the image smaller; the explicit list is what
# puppeteer's headless Chromium actually links against on Debian.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc-s1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    ca-certificates \
    wget \
  && rm -rf /var/lib/apt/lists/*

# Tell puppeteer to use the system Chromium (apt-installed) instead of
# downloading its bundled one — saves ~200MB and works on slim/arm64.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Install production dependencies only.
# --ignore-scripts skips the postinstall hook (RN-iAP patcher) and Chromium download.
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY llmClient.js ./
COPY server.js ./
COPY secureApiRoutes.js ./
COPY supabaseMcpClient.js ./
COPY routes/ ./routes/
COPY telephony/ ./telephony/
COPY middleware/ ./middleware/
COPY notifications/ ./notifications/
COPY services/ ./services/

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

CMD ["node", "server.js"]
