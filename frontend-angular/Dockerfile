# Этап 1: собираем Angular в обычные HTML/JS/CSS файлы
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build

# Этап 2: раздаём готовую сборку через nginx (Node.js в итоговом образе не нужен)
FROM nginx:1.27-alpine
COPY --from=build /app/dist/frontend-angular/browser /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
