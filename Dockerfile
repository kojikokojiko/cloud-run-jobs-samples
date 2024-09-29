# Stage 1: Build the TypeScript code
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

RUN npx tsc

# Stage 2: Create the runtime image
FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

CMD ["node", "dist/index.js"]
