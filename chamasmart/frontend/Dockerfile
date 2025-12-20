# Use Node.js LTS
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port (Vite default)
EXPOSE 5173
EXPOSE 4173

# Start command (dev mode with host binding)
CMD [ "npm", "run", "dev", "--", "--host" ]
