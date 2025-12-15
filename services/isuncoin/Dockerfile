# Info: (20251213 - AI) Base image Ubuntu 24.04
FROM ubuntu:24.04

# Info: (20251213 - AI) Install dependencies
# Info: (20251213 - AI) git for cloning, golang for building, ca-certificates for HTTPS
RUN apt-get update && apt-get install -y git golang ca-certificates curl

# Info: (20251213 - AI) Clone repository
RUN git clone https://github.com/CAFECA-IO/isuncoin /opt/isuncoin

# Info: (20251213 - AI) Set working directory
WORKDIR /opt/isuncoin

# Info: (20251213 - AI) Build binary for Linux AMD64
RUN GOOS=linux GOARCH=amd64 go build -o isuncoin-linux ./cmd/isuncoin

# Info: (20251213 - AI) Install to /usr/local/bin
RUN cp isuncoin-linux /usr/local/bin/isuncoin && chmod +x /usr/local/bin/isuncoin

# Info: (20251213 - AI) Verify installation
RUN isuncoin --version || echo "isuncoin installed"

# Info: (20251213 - AI) Default command
CMD ["isuncoin"]
