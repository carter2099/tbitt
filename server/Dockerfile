FROM node:22-alpine

WORKDIR /app

# Add build dependencies
RUN apk add --no-cache python3 make gcc

COPY package*.json ./
RUN npm install
RUN npm rebuild

# Create ssl directory
RUN mkdir -p ssl

COPY . .

# Build TypeScript for production
RUN npm run build

EXPOSE 3001 3443

# Use node to run the built JavaScript in production
CMD ["node", "dist/index.js"] 