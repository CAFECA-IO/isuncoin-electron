'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Terminal, X, Trash2, Minimize2, Maximize2 } from 'lucide-react';

interface ILogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'log' | 'debug';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[];
  source?: 'main' | 'renderer';
  scope?: string;
}

const DebugConsole: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [logs, setLogs] = useState<ILogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Tabs Logic
  const [tabs, setTabs] = useState<string[]>(['All']);
  const [selectedTab, setSelectedTab] = useState('All');

  useEffect(() => {
    // ... (console overrides)
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.debug,
    };

    const formatArgs = (args: unknown[]) => {
      return args;
    };

    const addLog = (level: ILogEntry['level'], args: unknown[], source: ILogEntry['source'] = 'renderer', timestamp?: string) => {
      // Parse Scope from first argument if string
      let scope = source === 'main' ? 'Main' : 'Renderer';
      const firstArg = args[0];
      if (typeof firstArg === 'string') {
        const match = firstArg.match(/^\[([^\]]+)\]/);
        if (match) {
          scope = match[1];
        }
      }

      const entry: ILogEntry = {
        timestamp: timestamp || new Date().toLocaleTimeString(),
        level,
        args: formatArgs(args),
        source,
        scope
      };

      setLogs((prev) => {
        const newLogs = [...prev.slice(-499), entry];
        return newLogs;
      });

      setTabs(prev => {
        if (!prev.includes(scope)) {
          return [...prev, scope];
        }
        return prev;
      });
    };

    console.log = (...args) => {
      originalConsole.log(...args);
      addLog('log', args);
    };

    console.warn = (...args) => {
      originalConsole.warn(...args);
      addLog('warn', args);
    };

    console.error = (...args) => {
      originalConsole.error(...args);
      addLog('error', args);
    };

    console.info = (...args) => {
      originalConsole.info(...args);
      addLog('info', args);
    };

    console.debug = (...args) => {
      originalConsole.debug(...args);
      addLog('debug', args);
    };

    // Listen to Main Process Logs
    if (window.electronAPI && window.electronAPI.onDebugLog) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.electronAPI.onDebugLog((data: any) => {
        addLog(data.level, data.args, 'main', data.timestamp);
      });
    }

    return () => {
      console.log = originalConsole.log;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
      console.info = originalConsole.info;
      console.debug = originalConsole.debug;
    };
  }, []);

  useEffect(() => {
    if (isOpen && !isMinimized && logsEndRef.current && isAtBottom) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isOpen, isMinimized, isAtBottom]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // Tolerance of 50px
    const atBottom = scrollHeight - scrollTop <= clientHeight + 50;
    setIsAtBottom(atBottom);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: 'var(--color-primary, #00E5FF)',
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
        title="Open Debug Console"
      >
        <Terminal size={24} />
      </button>
    );
  }

  if (isMinimized) {
    return (
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
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
        <Terminal size={16} />
        <span style={{ fontSize: '12px' }}>Debug Console ({logs.length})</span>
        <button onClick={() => setIsMinimized(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><Maximize2 size={14} /></button>
        <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={14} /></button>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '80px',
        right: '20px',
        width: '640px',
        height: '480px',
        background: 'rgba(10, 10, 10, 0.95)',
        border: '1px solid #333',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9999,
        boxShadow: '0 4px 20px rgba(0,0,0,0.7)',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '8px 12px',
        background: '#1a1a1a',
        borderBottom: '1px solid #333',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopLeftRadius: '8px',
        borderTopRightRadius: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ddd', fontSize: '13px', fontWeight: 'bold' }}>
          <Terminal size={14} />
          <span>Debug Console</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setLogs([])} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '2px' }} title="Clear"><Trash2 size={14} /></button>
          <button onClick={() => setIsMinimized(true)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '2px' }} title="Minimize"><Minimize2 size={14} /></button>
          <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '2px' }} title="Close"><X size={14} /></button>
        </div>
      </div>

      {/* Tabs Header */}
      <div style={{
        display: 'flex',
        background: 'rgba(0,0,0,0.3)',
        borderBottom: '1px solid #333',
        overflowX: 'auto',
        scrollbarWidth: 'none'
      }}>
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            style={{
              background: selectedTab === tab ? 'rgba(255,255,255,0.1)' : 'transparent',
              border: 'none',
              borderRight: '1px solid #333',
              color: selectedTab === tab ? '#fff' : '#888',
              padding: '6px 12px',
              fontSize: '11px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontFamily: 'monospace'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Logs Area */}
      <div
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px',
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#ccc',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
        {logs.length === 0 && (
          <div style={{ opacity: 0.3, textAlign: 'center', marginTop: '20px' }}>No logs captured yet.</div>
        )}
        {logs.filter(log => selectedTab === 'All' || log.scope === selectedTab).map((log, index) => (
          <div key={index} style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            lineHeight: '1.4',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
            paddingBottom: '2px'
          }}>
            <span style={{ color: '#666', width: '130px' }}>[{log.timestamp}]</span>
            <span style={{
              color: log.source === 'main' ? '#c77dff' : '#4ade80',
              fontSize: '10px',
              border: `1px solid ${log.source === 'main' ? '#c77dff' : '#4ade80'}`,
              borderRadius: '3px',
              padding: '0 4px',
              height: 'fit-content',
              marginTop: '2px',
              marginRight: '4px',
              width: '35px',
              textAlign: 'center'
            }}>
              {log.source === 'main' ? 'MAIN' : 'REND'}
            </span>
            {/* Scope Badge (if different from Main/Rend default concept, or just show text) 
                Actually user probably wants to see the scope as the primary tag now?
                The 'MAIN' / 'REND' tag is still useful for process origin.
                Let's add a scope tag if it's special (Service).

            <span style={{
              color: '#fff',
              fontSize: '10px',
              background: '#333',
              borderRadius: '3px',
              padding: '0 4px',
              height: 'fit-content',
              marginTop: '2px',
              marginRight: '4px',
              width: 'fit-content',
              minWidth: '35px',
              textAlign: 'center'
            }}>
              {log.scope?.substring(0, 10)}
            </span>

            */}

            <span style={{
              color: log.level === 'error' ? '#ff4d4d' : log.level === 'warn' ? '#ffca28' : log.level === 'info' ? '#4fc3f7' : '#999',
              textTransform: 'uppercase',
              width: '40px',
              fontWeight: 'bold'
            }}>{log.level}</span>
            <span style={{ width: '100%', wordBreak: 'break-all', whiteSpace: 'pre-wrap', color: log.level === 'error' ? '#ff8a80' : '#ddd' }}>
              {log.args.map(arg => {
                if (typeof arg === 'object') {
                  try {
                    return JSON.stringify(arg);
                  } catch {
                    return String(arg);
                  }
                }
                return String(arg);
              }).join(' ')}
            </span>
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};

export default DebugConsole;
