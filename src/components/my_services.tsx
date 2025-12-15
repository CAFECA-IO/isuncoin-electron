'use client';

import React, { useEffect, useState } from 'react';
import { Play, Square, Trash2 } from 'lucide-react';

import { IDockerContainer } from '@/types';

const MyServices: React.FC = () => {
  const [services, setServices] = useState<{
    name: string;
    container?: IDockerContainer;
    isRunning: boolean;
    isDefined: boolean;
  }[]>([]);

  const [loading, setLoading] = useState(false);

  const fetchServices = async () => {
    if (typeof window === 'undefined' || !window.electronAPI) return;
    try {
      const definedNames = await window.electronAPI.getDefinedServices();
      const containers = await window.electronAPI.getDockerContainers();

      const list: {
        name: string;
        container?: IDockerContainer;
        isRunning: boolean;
        isDefined: boolean;
      }[] = [];

      // 1. Defined Services
      definedNames.forEach(name => {
        const found = containers.find(c => c.names.includes(name) || c.image.includes(name));
        list.push({
          name: name,
          container: found,
          isRunning: !!found && found.status.toLowerCase().includes('up'),
          isDefined: true
        });
      });

      setServices(list);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    // Info: (20251214 - AI) Wrap async call to avoid direct setState warning (though async functions already defer)
    const init = async () => {
      await fetchServices();
    };
    init();
    const interval = setInterval(fetchServices, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (action: 'start' | 'stop' | 'deploy', target: string) => {
    setLoading(true);
    try {
      if (action === 'stop') await window.electronAPI.dockerStop(target);
      if (action === 'start') await window.electronAPI.dockerStart(target);
      if (action === 'deploy') await window.electronAPI.dockerDeploy(target);
      await fetchServices();
    } catch { alert('Action failed'); }
    setLoading(false);
  };

  return (
    <div id="view-services" className="view-section">
      <div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Status.</th>
              <th>Service Name</th>
              <th>Image</th>
              <th>Ports</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {services.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', opacity: 0.5 }}>No services defined</td></tr>
            ) : (
              services.map((s, i) => {
                const statusIcon = s.isRunning ? '🟢' : '⚪';
                const statusText = s.isRunning ? 'Running' : 'Not Deployed';
                const ports = s.container?.ports || '-';
                const image = s.container?.image || `(Service: ${s.name})`;
                const idOrName = s.container?.id || s.name;

                return (
                  <tr key={i}>
                    <td>{statusIcon} <span style={{ fontSize: '0.9em', opacity: 0.8 }}>{statusText}</span></td>
                    <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                      {s.name} <span style={{ fontSize: '0.8em', color: 'var(--text-secondary)' }}>(Defined)</span>
                    </td>
                    <td style={{ fontSize: '0.9em' }}>{image}</td>
                    <td style={{ fontSize: '0.9em', color: 'var(--text-secondary)' }}>{ports}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {s.isRunning ? (
                          <button className="btn-action stop" onClick={() => handleAction('stop', idOrName)} disabled={loading}>
                            <Square size={14} fill="currentColor" />
                          </button>
                        ) : (
                          <button className="btn-action start" onClick={() => handleAction(s.container ? 'start' : 'deploy', idOrName)} disabled={loading}>
                            <Play size={14} fill="currentColor" />
                          </button>
                        )}
                        <button className="btn-action delete" disabled>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MyServices;
