FROM node:20-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache python3 make g++

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build frontend and server
RUN npm run build

# Create necessary directories
RUN mkdir -p /data /appdata

# Set permissions
RUN chown -R node:node /app /data /appdata

# Switch to non-root user
USER node

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/server/index.js"]