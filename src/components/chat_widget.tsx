'use client';

import React, { useEffect, useState, useRef } from 'react';
import { MessageSquare, X, Send, Minimize2, Maximize2, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
          background: 'rgba(15, 15, 15, 0.98)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 9999,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(20px)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '15px', fontWeight: 600, letterSpacing: '0.01em' }}>
            <Bot size={20} color="#00E5FF" />
            <span style={{ textShadow: '0 0 10px rgba(0, 229, 255, 0.3)' }}>iSun AI ({model})</span>
            {!isServiceReady && (
              <span style={{
                fontSize: '11px',
                background: '#ff3d00',
                color: '#fff',
                padding: '2px 8px',
                borderRadius: '10px',
                marginLeft: '6px',
                fontWeight: 500
              }}>OFFLINE</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setIsMinimized(true)} style={{ background: 'none', border: 'none', color: '#a0a0a0', cursor: 'pointer', padding: '4px', transition: 'color 0.2s' }} title="Minimize"><Minimize2 size={16} /></button>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#a0a0a0', cursor: 'pointer', padding: '4px', transition: 'color 0.2s' }} title="Close"><X size={16} /></button>
          </div>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: '#555', marginTop: '40px', fontSize: '14px' }}>
              <p>How can I help you today?</p>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                background: msg.role === 'user' ? 'linear-gradient(135deg, #00695C 0%, #004D40 100%)' : 'rgba(255, 255, 255, 0.05)',
                color: msg.role === 'user' ? '#fff' : '#e0e0e0',
                padding: '12px 18px',
                borderRadius: '16px',
                borderBottomRightRadius: msg.role === 'user' ? '4px' : '16px',
                borderBottomLeftRadius: msg.role === 'assistant' ? '4px' : '16px',
                maxWidth: '85%',
                fontSize: '15px',
                lineHeight: '1.6',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                border: msg.role === 'assistant' ? '1px solid rgba(255, 255, 255, 0.05)' : 'none'
              }}>
                {msg.role === 'assistant' ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children, ...props }: React.ComponentPropsWithoutRef<'h1'>) => (
                          <h1 style={{ color: '#FFB74D', fontSize: '1.4rem', borderBottom: '1px solid #444', paddingBottom: '8px', marginBottom: '12px', marginTop: '20px', display: 'flex', alignItems: 'center', gap: '8px' }} {...props}>
                            <span style={{ fontSize: '1.2em' }}>🏆</span>
                            {children}
                          </h1>
                        ),
                        h2: ({ children, ...props }: React.ComponentPropsWithoutRef<'h2'>) => (
                          <h2 style={{ color: '#FFCC80', fontSize: '1.2rem', marginTop: '16px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }} {...props}>
                            <span style={{ width: '4px', height: '18px', background: '#FF9800', borderRadius: '2px', display: 'inline-block' }}></span>
                            {children}
                          </h2>
                        ),
                        h3: ({ children, ...props }: React.ComponentPropsWithoutRef<'h3'>) => (
                          <h3 style={{ color: '#FFE0B2', fontSize: '1.1rem', marginTop: '12px', marginBottom: '6px', fontWeight: 600 }} {...props}>
                            {children}
                          </h3>
                        ),
                        strong: ({ children, ...props }: React.ComponentPropsWithoutRef<'strong'>) => (
                          <strong style={{ color: '#FFB74D' }} {...props}>
                            {children}
                          </strong>
                        ),
                        ul: ({ children, ...props }: React.ComponentPropsWithoutRef<'ul'>) => (
                          <ul style={{ paddingLeft: '20px', listStyleType: 'none' }} {...props}>
                            {children}
                          </ul>
                        ),
                        li: ({ children, ...props }: React.ComponentPropsWithoutRef<'li'>) => (
                          <li style={{ position: 'relative', marginBottom: '6px', paddingLeft: '0px' }} {...props}>
                            <span style={{ position: 'absolute', left: '-18px', top: '7px', width: '6px', height: '6px', background: '#FF9800', borderRadius: '50%' }}></span>
                            {children}
                          </li>
                        ),
                        p: ({ children, ...props }: React.ComponentPropsWithoutRef<'p'>) => (
                          <p style={{ marginBottom: '10px', lineHeight: '1.7', color: '#E0E0E0' }} {...props}>
                            {children}
                          </p>
                        ),
                        a: ({ children, ...props }: React.ComponentPropsWithoutRef<'a'>) => (
                          <a style={{ color: '#64B5F6', textDecoration: 'underline' }} {...props}>
                            {children}
                          </a>
                        ),
                        blockquote: ({ children, ...props }: React.ComponentPropsWithoutRef<'blockquote'>) => (
                          <blockquote style={{ borderLeft: '4px solid #FF9800', background: 'rgba(255, 152, 0, 0.1)', padding: '10px 14px', borderRadius: '4px', margin: '10px 0', fontStyle: 'italic', color: '#FFE0B2' }} {...props}>
                            {children}
                          </blockquote>
                        ),
                        table: ({ children, ...props }: React.ComponentPropsWithoutRef<'table'>) => (
                          <div style={{ overflowX: 'auto', margin: '20px 0' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #444', fontSize: '0.9rem' }} {...props}>
                              {children}
                            </table>
                          </div>
                        ),
                        thead: ({ children, ...props }: React.ComponentPropsWithoutRef<'thead'>) => (
                          <thead style={{ background: 'rgba(255, 255, 255, 0.05)' }} {...props}>
                            {children}
                          </thead>
                        ),
                        tbody: ({ children, ...props }: React.ComponentPropsWithoutRef<'tbody'>) => (
                          <tbody {...props}>{children}</tbody>
                        ),
                        tr: ({ children, ...props }: React.ComponentPropsWithoutRef<'tr'>) => (
                          <tr style={{ borderBottom: '1px solid #333' }} {...props}>{children}</tr>
                        ),
                        th: ({ children, ...props }: React.ComponentPropsWithoutRef<'th'>) => (
                          <th style={{ padding: '12px', textAlign: 'left', borderRight: '1px solid #444', color: '#FFB74D', fontWeight: 600 }} {...props}>
                            {children}
                          </th>
                        ),
                        td: ({ children, ...props }: React.ComponentPropsWithoutRef<'td'>) => (
                          <td style={{ padding: '12px', textAlign: 'left', borderRight: '1px solid #444', color: '#E0E0E0' }} {...props}>
                            {children}
                          </td>
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : msg.content}
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div style={{ alignSelf: 'flex-start', color: '#666', fontStyle: 'normal', fontSize: '13px', marginLeft: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Bot size={14} /> Thinking...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          background: 'rgba(20, 20, 20, 0.8)',
          display: 'flex',
          gap: '12px',
          borderBottomLeftRadius: '16px',
          borderBottomRightRadius: '16px',
          alignItems: 'flex-end'
        }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="Message Input"
            placeholder="Type a message..."
            disabled={isLoading || !isServiceReady}
            style={{
              flex: 1,
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '12px 14px',
              color: '#fff',
              fontSize: '14px',
              outline: 'none',
              resize: 'none',
              minHeight: '44px',
              maxHeight: '120px',
              fontFamily: 'inherit',
              lineHeight: '1.5'
            }}
            onFocus={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)'}
            onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim() || !isServiceReady}
            aria-label="Send Message"
            style={{
              background: isLoading || !input.trim() || !isServiceReady ? '#333' : '#00E5FF',
              color: isLoading || !input.trim() || !isServiceReady ? '#666' : '#000',
              border: 'none',
              borderRadius: '12px',
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isLoading || !input.trim() || !isServiceReady ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              fontWeight: 'bold'
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
