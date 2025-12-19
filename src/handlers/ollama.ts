import { IpcMainEvent, net } from 'electron';

export const handleOllamaChat = async (event: IpcMainEvent, payload: { model: string, messages: { role: string, content: string }[] }) => {
  const { model, messages } = payload;

  const requestData = JSON.stringify({
    model,
    messages,
    stream: true
  });

  try {
    console.log(requestData);
    const response = await net.fetch('http://ollama.localhost/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: requestData
    });

    if (!response.body) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        event.sender.send('ollama-reply', { done: true });
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim() !== '');

      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          if (json.message) {
            event.sender.send('ollama-reply', {
              content: json.message.content,
              done: json.done
            });
          }
          if (json.done) {
            // Will break in next loop iteration or when reader is done, but explicit send safe
          }
        } catch (e) {
          console.error('Error parsing ollama chunk', e);
        }
      }
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    console.error('Ollama request error', e);
    event.sender.send('ollama-reply', { error: errorMessage, done: true });
  }
};
