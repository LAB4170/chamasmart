# Use Node.js 22
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with legacy-peer-deps fix
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Expose port
EXPOSE 5000

# Start command (dev mode for hot reload)
CMD [ "npm", "run", "dev" ]
