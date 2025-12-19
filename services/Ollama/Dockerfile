FROM ollama/ollama:latest

# Install curl for healthcheck/API usage if needed
# ollama/ollama is based on ubuntu/debian usually, but let's check. 
# Actually official image might be minimal.
# Let's assume apt-get works or use a different base if needed. 
# Official docs say it's based on ubuntu.
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY start.sh /start.sh
RUN chmod +x /start.sh

ENTRYPOINT ["/start.sh"]
