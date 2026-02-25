# Use an official Node.js runtime
FROM node:22-alpine

# Set the working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the frontend source code
COPY . .

# Expose the port Vite runs on
EXPOSE 3000

# Start the Vite development server, exposing it to the Docker network
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]