# Use Node.js LTS
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# Install only production dependencies
# RUN npm ci --only=production
# For development, we want all dependencies including nodemon
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 5000

# Start command (dev mode for hot reload)
CMD [ "npm", "run", "dev" ]
