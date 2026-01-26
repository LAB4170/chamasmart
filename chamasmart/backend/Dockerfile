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

# Expose port (matches backend PORT=5005)
EXPOSE 5005

# Start command (use environment to determine mode)
CMD [ "sh", "-c", "if [ \"$NODE_ENV\" = \"production\" ]; then npm start; else npm run dev; fi" ]
