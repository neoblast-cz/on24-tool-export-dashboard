# Stage 1 — build
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN mkdir -p reports && npm run build

# Stage 2 — production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy standalone bundle
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy any existing reports (uploaded xlsx files)
COPY --from=builder /app/reports ./reports

EXPOSE 8080

CMD ["node", "server.js"]
