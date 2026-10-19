FROM oven/bun:1.2 AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/ ./packages/
COPY apps/bingo-frontend/package.json ./apps/bingo-frontend/
RUN bun install
COPY . .
WORKDIR /app/apps/bingo-frontend
ARG VITE_API_URL
ARG VITE_WS_URL
ARG VITE_ENGINE_URL
ARG VITE_BOT_USERNAME
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_ENGINE_URL=$VITE_ENGINE_URL
ENV VITE_BOT_USERNAME=$VITE_BOT_USERNAME
RUN bun run build

FROM nginx:alpine
COPY --from=build /app/apps/bingo-frontend/dist /usr/share/nginx/html
COPY apps/bingo-frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]