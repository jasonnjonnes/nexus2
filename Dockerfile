FROM node:20-slim

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --quiet

# Copy the rest of the application
COPY . .

# Build the application - skip TypeScript checks since we're in CI mode
RUN NODE_ENV=production npm run build

# Expose the port the app runs on
ENV PORT=8080
EXPOSE 8080

# Command to run the application
CMD ["node", "server.js"] 