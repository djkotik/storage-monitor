FROM node:20-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache python3 make g++

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# Create data directory
RUN mkdir -p /data

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]