# THE BAR realtime + persistence server (server/index.ts).
# Build from the repo root:  docker build -f server/Dockerfile -t thebar-server .
# Run:                       docker run -p 8787:8787 -v thebar-data:/app/data thebar-server
FROM node:24-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod=false
COPY server ./server
COPY src/modules/scorebus/api.ts ./src/modules/scorebus/api.ts
ENV NODE_ENV=production PORT=8787 DB_PATH=/app/data/thebar.sqlite
EXPOSE 8787
VOLUME ["/app/data"]
CMD ["pnpm", "server"]
