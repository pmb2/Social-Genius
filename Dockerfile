FROM node:18-slim AS base

# Install dependencies and Playwright browsers
FROM base AS deps
WORKDIR /app

# Install dependencies required for Playwright and PostgreSQL
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxcb1 \
    libxkbcommon0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0 \
    fonts-liberation \
    wget \
    xvfb \
    zip \
    unzip \
    libc6-dev \
    libpq-dev \
    postgresql-client \
    build-essential \
    python3 \
    make \
    g++

# Copy package files
COPY package.json package-lock.json ./
RUN npm ci
RUN npm install @radix-ui/react-dropdown-menu

# Install Playwright browsers
RUN npx playwright install chromium
RUN npx playwright install-deps chromium

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Create a simple middleware.js file
RUN echo "export default function middleware() { return; }" > middleware.js
RUN echo "export default function middleware() { return; }" > middleware.ts

# For development, make sure we use src/app as the main app directory
RUN if [ -d "src/app" ]; then cp -r src/app/* app/ || true; fi

# Set environment variables
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}
ARG OPENAI_API_KEY
ENV OPENAI_API_KEY=${OPENAI_API_KEY}
ARG GROQ_API_KEY
ENV GROQ_API_KEY=${GROQ_API_KEY}
ARG EXA_API_KEY
ENV EXA_API_KEY=${EXA_API_KEY}
ARG GOOGLE_MAPS_API_KEY
ENV GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY}

# Add fix for pg-pool
COPY fix-pg-pool.cjs ./
COPY pg-patch.cjs ./

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

# Copy Playwright binaries and dependencies from deps stage
COPY --from=deps /root/.cache/ms-playwright /root/.cache/ms-playwright

# Install runtime dependencies including PostgreSQL client libraries
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxcb1 \
    libxkbcommon0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0 \
    fonts-liberation \
    libpq5 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy pg-patch
COPY --from=builder /app/fix-pg-pool.cjs ./
COPY --from=builder /app/pg-patch.cjs ./
COPY --from=builder /app/node_modules_patch.cjs ./

# Create a simple middleware file
RUN echo "export default function middleware() { return; }" > middleware.js

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Create and set permissions for temp directory (for PDF processing)
RUN mkdir -p /tmp && chmod 777 /tmp

# Create directory for browser cookies
RUN mkdir -p /app/browser_cookies && chmod 777 /app/browser_cookies

# Set path to playwright browsers
ENV PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright

# Modify permissions for Playwright browser directories
RUN chmod -R 755 /root/.cache/ms-playwright

# Run the application with patched PostgreSQL modules
EXPOSE 3000
ENV PORT 3000

# Apply pg patches and run server
CMD ["sh", "-c", "node node_modules_patch.cjs && node -e \"require('./pg-patch.cjs'); console.log('✅ PG patches applied before server start')\" && NODE_ENV=production node server.js"]
