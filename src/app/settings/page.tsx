'use client';

import React, { useEffect, useState } from 'react';

export default function SettingsPage() {
  const [tidebitBranch, setTidebitBranch] = useState('main');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchConfig = async () => {
      if (window.electronAPI) {
        const config = await window.electronAPI.getServiceConfig('TideBit');
        if (config && config.branch) {
          setTidebitBranch(config.branch as string);
        }
      }
      setLoading(false);
    };
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setMessage('');
    if (window.electronAPI) {
      const result = await window.electronAPI.saveServiceConfig('TideBit', { branch: tidebitBranch });
      if (result.success) {
        setMessage('Saved successfully. Service is redeploying...');
      } else {
        setMessage('Error saving config: ' + result.error);
      }
    }
    setLoading(false);
  };

  return (
    <div className="view-section active" style={{ height: '100%', padding: '20px', color: '#fff' }}>
      <h2>Settings</h2>

      <div style={{ marginTop: '20px', background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '8px' }}>
        <h3>TideBit Configuration</h3>
        <div style={{ marginTop: '15px' }}>
          <label htmlFor="git-branch" style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#ccc' }}>
            Git Branch
          </label>
          <input
            id="git-branch"
            aria-label="Git Branch"
            type="text"
            value={tidebitBranch}
            onChange={(e) => setTidebitBranch(e.target.value)}
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid #444',
              borderRadius: '4px',
              padding: '8px',
              color: '#fff',
              width: '100%',
              maxWidth: '300px'
            }}
            placeholder="main"
          />
        </div>
        <div style={{ marginTop: '20px' }}>
          <button
            onClick={handleSave}
            disabled={loading}
            style={{
              background: loading ? '#555' : 'var(--color-primary, #00E5FF)',
              color: loading ? '#ccc' : '#000',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
        {message && (
          <div style={{ marginTop: '15px', color: message.startsWith('Error') ? '#ff4d4d' : '#4ade80' }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
