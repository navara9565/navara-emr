# NAVARA EMR — build + run in one small image.
# Works on Render / Fly.io / Railway / Oracle VM (docker) / any Docker host.
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server ./server
COPY src ./src

# Database lives here — mount a persistent volume/disk at /data.
ENV EMR_DATA_DIR=/data
VOLUME /data

EXPOSE 3000
CMD ["node", "--no-warnings", "server/index.js"]
