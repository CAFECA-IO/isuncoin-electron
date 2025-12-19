#!/bin/bash
set -e

# Initialize IPFS if config missing
if [ ! -f "$IPFS_PATH/config" ]; then
  echo "Initializing IPFS..."
  ipfs init
  ipfs config Addresses.API /ip4/0.0.0.0/tcp/5001
  ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/8080
fi

# Start IPFS Daemon in background
echo "Starting IPFS Daemon..."
ipfs daemon &

# Wait for IPFS API to be ready
echo "Waiting for IPFS..."
sleep 5

# Start SwarmStorage
echo "Starting SwarmStorage..."
cd /swarm-storage
npm run swarm
