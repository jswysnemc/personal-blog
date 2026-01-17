# Stage 1: Build the Astro frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Build-time arguments for PUBLIC_* environment variables (Astro requires these at build time)
ARG PUBLIC_SOCIAL_LINKS
ARG PUBLIC_SITE_TITLE
ARG PUBLIC_SITE_DESCRIPTION
ARG PUBLIC_SITE_AUTHOR
ARG PUBLIC_SHOW_ADMIN_LINK
ARG PUBLIC_COPYRIGHT_START_YEAR

# Set as environment variables for the build process
ENV PUBLIC_SOCIAL_LINKS=$PUBLIC_SOCIAL_LINKS
ENV PUBLIC_SITE_TITLE=$PUBLIC_SITE_TITLE
ENV PUBLIC_SITE_DESCRIPTION=$PUBLIC_SITE_DESCRIPTION
ENV PUBLIC_SITE_AUTHOR=$PUBLIC_SITE_AUTHOR
ENV PUBLIC_SHOW_ADMIN_LINK=$PUBLIC_SHOW_ADMIN_LINK
ENV PUBLIC_COPYRIGHT_START_YEAR=$PUBLIC_COPYRIGHT_START_YEAR

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build the Astro site
RUN npm run build

# Stage 2: Production image
FROM node:20-alpine AS production

WORKDIR /app

# Copy built Astro standalone server
COPY --from=builder /app/dist ./dist

# Copy server files for API
COPY --from=builder /app/server ./server
COPY --from=builder /app/src/content ./src/content

# Copy package.json for tsx
COPY --from=builder /app/package*.json ./

# Install runtime dependencies
RUN npm install tsx --save-dev && npm cache clean --force

# Create data directory for comments
RUN mkdir -p /app/data && echo '{}' > /app/data/comments.json

# Set environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321
ENV API_PORT=3001
ENV API_INTERNAL_URL=http://localhost:3001

# Only expose Astro port - API is internal only
EXPOSE 4321

# Start both servers (API runs internally, Astro proxies requests)
CMD ["sh", "-c", "npx tsx server/index.ts & node ./dist/server/entry.mjs"]
