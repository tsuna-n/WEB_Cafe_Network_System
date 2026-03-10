FROM node:20-slim

WORKDIR /app

# Install dependencies needed for canvas at runtime / ts-node
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    python3 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build
RUN mkdir -p uploads/receipts

ENV NODE_ENV=production
EXPOSE 3003

CMD ["npm", "start"]
