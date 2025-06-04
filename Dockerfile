# Base image with Node and Playwright
FROM mcr.microsoft.com/playwright:v1.43.1-jammy

# Create app directory
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy the rest of the app
COPY . .

# Expose web port
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
