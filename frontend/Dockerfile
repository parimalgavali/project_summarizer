FROM node:20-alpine AS build

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy the rest of the source code
COPY . .

ARG VITE_API_BASE
ENV VITE_API_BASE=$VITE_API_BASE

# Build the production-ready static files
RUN npm run build

# Use Nginx to serve static files and copy the built assets from the 'build' stage
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html

# Expose the port
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]