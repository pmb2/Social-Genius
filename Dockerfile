FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

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

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

# Copy necessary files
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create and set permissions for temp directory (for PDF processing)
USER root
RUN mkdir -p /tmp && chmod 777 /tmp
USER nextjs

# Run the application
EXPOSE 3000
ENV PORT 3000
CMD ["node", "server.js"]