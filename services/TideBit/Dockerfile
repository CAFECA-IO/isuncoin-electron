FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y git ca-certificates

# Clone TideBit-DeFi from GitHub
ARG BRANCH=main
RUN git clone -b $BRANCH https://github.com/CAFECA-IO/TideBit-DeFi.git /opt/tidebit
WORKDIR /opt/tidebit
RUN npm install && npm run build

# Start Script
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Info: (20251213 - AI) Default command
CMD ["/start.sh"]
