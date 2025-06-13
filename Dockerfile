# Stage 1: Build dependencies
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files for better layer caching
COPY package*.json ./

# Install dependencies with clean cache to reduce image size
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Create the runtime image
FROM node:22-alpine

# Set environment variables
ENV NODE_ENV=production
ENV ADDON_PORT=7777

# Set working directory
WORKDIR /app

# Copy only the necessary files from the builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY . .

# Expose the port the app runs on (using the ADDON_PORT environment variable)
EXPOSE ${ADDON_PORT}

# Health check to verify the application is running
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${ADDON_PORT}/ || exit 1

# Command to run the application
CMD ["node", "app.js"]