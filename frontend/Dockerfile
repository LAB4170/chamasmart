# Use Node.js 22
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Create a non-root user
RUN addgroup -g 1001 -S nodeuser && \
    adduser -S nodeuser -u 1001

# Copy package files
COPY package*.json ./

# Install dependencies with legacy-peer-deps fix
RUN npm install --legacy-peer-deps

# Copy source code
COPY --chown=nodeuser:nodeuser . .

# Expose port (Vite default)
EXPOSE 5173
EXPOSE 4173

# Switch to non-root user
USER nodeuser

# Start command (use environment to determine mode)
CMD [ "sh", "-c", "if [ \"$NODE_ENV\" = \"production\" ]; then npm run build && npm run preview -- --host 0.0.0.0; else npm run dev -- --host 0.0.0.0; fi" ]
