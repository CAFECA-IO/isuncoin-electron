#!/bin/bash

# Start Ollama in background
ollama serve &
PID=$!

echo "Waiting for Ollama API..."
until curl -s http://localhost:11434/api/tags >/dev/null; do
    sleep 1
done
echo "Ollama API ready."

if [ ! -z "$OLLAMA_MODEL" ]; then
    echo "Checking model: $OLLAMA_MODEL"
    # output of ollama list looks like:
    # NAME            ID              SIZE    MODIFIED
    # llama2:latest   78e26419b446    3.8 GB  4 weeks ago
    if ! ollama list | grep -q "$OLLAMA_MODEL"; then
        echo "Pulling model: $OLLAMA_MODEL..."
        ollama pull "$OLLAMA_MODEL"
    fi
    echo "Model $OLLAMA_MODEL is ready."
    
    # Optional: Pre-load the model?
    # ollama run "$OLLAMA_MODEL" ""
fi

wait $PID
