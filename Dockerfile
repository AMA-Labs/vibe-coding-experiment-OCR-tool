FROM node:20-slim

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json* ./
COPY client/package.json client/package-lock.json* ./client/

# Install dependencies
RUN npm install --production=false
RUN cd client && npm install

# Copy source
COPY . .

# Build client
RUN cd client && npm run build

# Clean up dev dependencies
RUN npm prune --production

# Create directories
RUN mkdir -p server/uploads server/data

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "server/index.js"]
