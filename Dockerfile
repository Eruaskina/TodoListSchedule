FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine

LABEL org.opencontainers.image.source="https://github.com/Eruaskina/TodoListSchedule"
LABEL org.opencontainers.image.description="Dizin — Görevler (Todo) ve Know-How Bilgi Bankası"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
