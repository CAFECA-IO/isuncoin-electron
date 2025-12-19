#!/bin/bash

# Start TideBit
echo "Starting TideBit..."
cd /opt/tidebit
git pull
npm install && npm run build
npm run swarm
