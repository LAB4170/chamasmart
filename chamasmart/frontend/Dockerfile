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

# Expose port (Vite default)
EXPOSE 5173
EXPOSE 4173

# Start command (use environment to determine mode)
CMD [ "sh", "-c", "if [ \"$NODE_ENV\" = \"production\" ]; then npm run build && npm run preview -- --host 0.0.0.0; else npm run dev -- --host 0.0.0.0; fi" ]
