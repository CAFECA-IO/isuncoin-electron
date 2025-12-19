'use client';

import React, { useEffect, useState, useRef } from 'react';
import { MessageSquare, X, Send, Minimize2, Maximize2, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface IMessage {
  role: 'user' | 'assistant';
  content: string;
}

const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [model, setModel] = useState('gemma3:4b'); // Default, could fetch from config
  const [isServiceReady, setIsServiceReady] = useState(false);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  // Check Service Status
  useEffect(() => {
    if (!window.electronAPI) return;

    const checkStatus = async () => {
      try {
        const isReachable = await window.electronAPI.checkUrl('http://ollama.localhost');
        setIsServiceReady(isReachable);
      } catch (e) {
        console.error('Failed to check status', e);
        setIsServiceReady(false);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000); // Poll every 5s

    return () => clearInterval(interval);
  }, []);

  // Fetch configured model on mount/open
  useEffect(() => {
    if (!window.electronAPI) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window.electronAPI.getServiceConfig('Ollama').then((conf: any) => {
      console.log('[ChatWidget] Loaded config:', conf);
      if (conf.model) {
        setModel(conf.model);
      }
    }).catch((err: Error) => {
      console.error('[ChatWidget] Failed to load config:', err);
    });
  }, [isOpen]);

  // Listen for replies
  useEffect(() => {
    if (!window.electronAPI) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const removeListener = window.electronAPI.onOllamaReply((data: any) => {
      // ... same logic but inside callback
      if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.error}` }]);
        setIsLoading(false);
        return;
      }

      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant' && isLoading) {
          // Append to last message
          const newContent = last.content + (data.content || '');
          const newPrev = [...prev];
          newPrev[newPrev.length - 1] = { ...last, content: newContent };
          return newPrev;
        } else if (data.content) {
          // If we pre-initialized, this might append to it if logic matches, 
          // or create new if we didn't found one.
          // BUT since we assume unique listener now, duplicates gone.
          return [...prev, { role: 'assistant', content: data.content }];
        }
        return prev;
      });

      if (data.done) {
        setIsLoading(false);
      }
    });

    return () => removeListener();
  }, [isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: IMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Initial empty assistant message to stream into
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    // Prepare history
    // We can send full history or just last few. For now, simple history.
    // Filter out empty assistant messages if any
    const history = [...messages, userMsg].filter(m => m.content);

    window.electronAPI.ollamaChat(model, history);
  };


  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '80px', // Next to Debug Console (20px + 50px + 10px spacing)
          background: 'linear-gradient(135deg, #00C853, #69F0AE)',
          color: '#000',
          border: 'none',
          borderRadius: '50%',
          width: '50px',
          height: '50px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 9999,
          boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
        }}
        title="Ollama Chat"
      >
        <MessageSquare size={24} />
      </button>
    );
  }


  if (isMinimized) {
    return (
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '80px',
        background: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '8px',
        padding: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        zIndex: 9999,
        color: '#fff',
        boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
      }}>
        <Bot size={16} />
        <span style={{ fontSize: '12px' }}>Ollama Chat</span>
        <button onClick={() => setIsMinimized(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }} aria-label="Maximize"><Maximize2 size={14} /></button>
        <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }} aria-label="Close"><X size={14} /></button>
      </div>
    )
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label="Close overlay"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setIsOpen(false);
          }
        }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(5px)',
          zIndex: 9998,
          display: isOpen && !isMinimized ? 'block' : 'none',
          cursor: 'default'
        }}
        onClick={() => setIsOpen(false)}
      />
      <div
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '25px',
          width: '640px',
          height: '500px',
          background: 'rgba(20, 20, 20, 0.95)',
          border: '1px solid #333',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 9999,
          boxShadow: '0 4px 20px rgba(0,0,0,0.7)',
          backdropFilter: 'blur(10px)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '12px',
          background: '#1a1a1a',
          borderBottom: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ddd', fontSize: '14px', fontWeight: 'bold' }}>
            <Bot size={18} color="#69F0AE" />
            <span style={{ color: '#69F0AE' }}>Ollama Chat ({model})</span>
            {!isServiceReady && (
              <span style={{
                fontSize: '10px',
                background: '#ffca28',
                color: '#000',
                padding: '2px 6px',
                borderRadius: '4px',
                marginLeft: '4px'
              }}>Offline</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setIsMinimized(true)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '2px' }} title="Minimize" aria-label="Minimize"><Minimize2 size={14} /></button>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '2px' }} title="Close" aria-label="Close"><X size={14} /></button>
          </div>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '15px',
          display: 'flex',
          flexDirection: 'column',
          gap: '15px',
        }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: '#666', marginTop: '20px', fontSize: '0.9rem' }}>
              Start a conversation with {model}...
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                background: msg.role === 'user' ? '#00695C' : '#333',
                color: '#fff',
                padding: '10px 14px',
                borderRadius: '12px',
                borderBottomRightRadius: msg.role === 'user' ? '2px' : '12px',
                borderBottomLeftRadius: msg.role === 'assistant' ? '2px' : '12px',
                maxWidth: '85%',
                fontSize: '0.95rem',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap'
              }}>
                {msg.role === 'assistant' ? (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                ) : msg.content}
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div style={{ alignSelf: 'flex-start', color: '#888', fontStyle: 'italic', fontSize: '0.8rem', marginLeft: '10px' }}>
              Thinking...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '10px',
          borderTop: '1px solid #333',
          background: '#1a1a1a',
          display: 'flex',
          gap: '10px',
          borderBottomLeftRadius: '12px',
          borderBottomRightRadius: '12px'
        }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="Message Input"
            placeholder={isServiceReady ? "Type a message..." : "Waiting for Ollama service..."}
            disabled={!isServiceReady}
            style={{
              flex: 1,
              background: '#222',
              border: '1px solid #444',
              borderRadius: '8px',
              color: '#fff',
              padding: '10px',
              resize: 'none',
              fontSize: '14px',
              height: '40px',
              minHeight: '40px',
              maxHeight: '100px',
              fontFamily: 'inherit',
              opacity: isServiceReady ? 1 : 0.5,
              cursor: isServiceReady ? 'text' : 'not-allowed'
            }}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim() || !isServiceReady}
            aria-label="Send Message"
            style={{
              background: (isLoading || !input.trim() || !isServiceReady) ? '#444' : '#00C853',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              width: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: (isLoading || !input.trim() || !isServiceReady) ? 'not-allowed' : 'pointer'
            }}
          >
            <Send size={18} />
          </button>
        </div>

      </div>
    </>
  );
};

export default ChatWidget;
