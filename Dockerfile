# Build stage
FROM node:20-slim AS build

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Production stage
FROM node:20-slim

# Set environment to production
ENV NODE_ENV=production

WORKDIR /app

# Copy node modules and package files from build stage
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./

# Copy application source code
COPY . .

# Expose ports for Express and Socket.IO
# Default Express port is typically 3000, adjust if your app uses different ports
EXPOSE 3000
# Socket.IO typically uses the same port as Express in Node.js applications
# If you're using a separate port for Socket.IO, add another EXPOSE statement

# Command to run the application
CMD ["node", "game-server.js"]

