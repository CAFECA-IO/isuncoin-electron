# Info: SwarmStorage requires Node.js, but ipfs/kubo is minimal/busybox and lacks package manager.
# We use node:20-bookworm-slim as base and copy IPFS binary from the official image.

FROM ipfs/kubo:latest AS ipfs_source

FROM node:20-bookworm-slim

# Install git
RUN apt-get update && apt-get install -y git

# Copy IPFS binary
COPY --from=ipfs_source /usr/local/bin/ipfs /usr/local/bin/ipfs

# Setup IPFS environment
ENV IPFS_PATH=/root/.ipfs
RUN ipfs init || true
RUN ipfs config Addresses.API /ip4/0.0.0.0/tcp/5001
RUN ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/8080

# Clone and Build SwarmStorage
RUN git clone https://github.com/CAFECA-IO/SwarmStorage.git /swarm-storage
WORKDIR /swarm-storage
RUN npm install && npm run build

# Start Script
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Info: (20251213 - AI) Default command
CMD ["/start.sh"]
