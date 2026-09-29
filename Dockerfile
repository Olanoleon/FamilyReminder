FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production NODE_OPTIONS=--disable-warning=ExperimentalWarning
COPY package*.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build && npm prune --omit=dev
ENV DB_PATH=/data/family.db
CMD ["npm", "start"]
