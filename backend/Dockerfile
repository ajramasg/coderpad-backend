FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PATH="/root/.cargo/bin:${PATH}"

# Install Node.js 20 + all language runtimes in a single layer
RUN apt-get update && \
    apt-get install -y curl gnupg ca-certificates && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y \
      nodejs \
      python3 python3-pip \
      default-jdk \
      gcc g++ \
      golang-go \
      ruby \
      php-cli \
      rustc cargo && \
    pip3 install pandas numpy --no-cache-dir && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json tsconfig.json ./
COPY src/ ./src/

RUN npm install
RUN npm run build

EXPOSE 3001
CMD ["node", "dist/index.js"]
