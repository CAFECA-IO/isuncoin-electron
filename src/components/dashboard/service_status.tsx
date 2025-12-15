import React, { useEffect, useState, useRef } from 'react';
import { Settings, X, Save } from 'lucide-react';
import { IDockerContainer } from '@/types';

const ServiceStatus: React.FC = () => {
  const [services, setServices] = useState<string[]>([]);
  const [containers, setContainers] = useState<IDockerContainer[]>([]);
  // const [version, setVersion] = useState<string>('Loading...');
  const [balance, setBalance] = useState<string>('--- ISC');
  const [isuncoinPerf, setIsuncoinPerf] = useState<string>('medium');
  const processingRef = useRef<Set<string>>(new Set());

  // Config State
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [config, setConfig] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchAndManage = async () => {
      if (typeof window === 'undefined' || !window.electronAPI) return;
      try {
        const defined = await window.electronAPI.getDefinedServices();
        const currentContainers = await window.electronAPI.getDockerContainers();
        setServices(defined);
        setContainers(currentContainers);

        // Fetch extra info
        if (defined.includes('iSunCoin')) {
          await window.electronAPI.getIsuncoinVersion();
          // setVersion(ver); // Info: (20251214 - AI) version state usage removed as it was unused locally

          // Get Performance
          const conf = await window.electronAPI.getServiceConfig('iSunCoin');
          setIsuncoinPerf((conf.performance as string) || 'medium');

          // Check balance only if running
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const container = currentContainers.find((c: any) => c.names === 'iSunCoin' || c.names.includes('iSunCoin'));
          if (container && container.status.startsWith('Up')) {
            const bal = await window.electronAPI.getServiceBalance();
            setBalance(bal);
          } else {
            setBalance('--- ISC');
          }
        }

        // Auto-start logic (Skip TideBit-DeFi)
        for (const serviceName of defined) {
          if (serviceName === 'TideBit-DeFi') continue; // EXCLUDE TideBit-DeFi
          if (processingRef.current.has(serviceName)) continue;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const container = currentContainers.find((c: any) => c.names === serviceName || c.names.includes(serviceName));
          let status = 'NOT DEPLOYED';
          let id: string | null = null;

          if (container) {
            id = container.id;
            if (container.status.startsWith('Up')) status = 'RUNNING';
            else status = 'STOPPED';
          }

          if (status !== 'RUNNING') {
            // Add to processing
            processingRef.current.add(serviceName);

            // Perform action in background
            (async () => {
              try {
                if (status === 'NOT DEPLOYED') {
                  await window.electronAPI.dockerDeploy(serviceName);
                } else {
                  await window.electronAPI.dockerStart(id!);
                }
              } catch (e) {
                console.error(`Auto-start failed for ${serviceName}`, e);
              } finally {
                processingRef.current.delete(serviceName);
              }
            })();
          }
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchAndManage();
    const interval = setInterval(fetchAndManage, 10000);
    return () => clearInterval(interval);
  }, []);

  const getServiceStatus = (serviceName: string) => {
    if (serviceName === 'TideBit-DeFi') return 'COMING SOON';
    const container = containers.find(c => c.names === serviceName || c.names.includes(serviceName));
    if (!container) return 'NOT DEPLOYED';
    if (container.status.startsWith('Up')) return 'RUNNING';
    return 'STOPPED';
  };

  const openSettings = async (serviceName: string) => {
    if (serviceName === 'TideBit-DeFi') return; // Disable settings
    if (!window.electronAPI) return;
    setSelectedService(serviceName);
    setIsConfigOpen(true);
    setSaving(false);

    try {
      const loadedConfig = await window.electronAPI.getServiceConfig(serviceName);
      // Default values for iSunCoin if partial or empty
      if (serviceName === 'iSunCoin') {
        if (!loadedConfig.address) loadedConfig.address = '';
        if (!loadedConfig.performance) loadedConfig.performance = 'medium';
      }
      setConfig(loadedConfig);
    } catch (e) {
      console.error('Error loading config', e);
      setConfig({});
    }
  };

  const closeSettings = () => {
    setIsConfigOpen(false);
    setSelectedService(null);
  };

  const handleSave = async () => {
    if (!selectedService || !window.electronAPI) return;
    setSaving(true);
    try {
      await window.electronAPI.saveServiceConfig(selectedService, config);
      closeSettings();
    } catch (e) {
      console.error('Failed to save', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      {/* Config Modal */}
      {isConfigOpen && selectedService && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(5px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--color-primary)',
            borderRadius: '12px',
            width: '400px',
            padding: '1.5rem',
            boxShadow: '0 0 20px rgba(0, 229, 255, 0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, color: 'var(--color-primary)' }}>{selectedService} Settings</h3>
              <button onClick={closeSettings} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {selectedService === 'iSunCoin' ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label htmlFor="wallet-address" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Wallet Address</label>
                    <input
                      id="wallet-address"
                      type="text"
                      value={config.address || ''}
                      onChange={(e) => setConfig({ ...config, address: e.target.value })}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        color: 'var(--text-primary)',
                        outline: 'none'
                      }}
                      placeholder="Enter wallet address"
                      aria-label="Wallet Address"
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Performance Level</span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {['low', 'medium', 'high'].map((level) => (
                        <button
                          key={level}
                          onClick={() => setConfig({ ...config, performance: level })}
                          style={{
                            flex: 1,
                            padding: '0.5rem',
                            background: config.performance === level ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)',
                            color: config.performance === level ? '#000' : 'var(--text-primary)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                            fontWeight: config.performance === level ? 'bold' : 'normal',
                            transition: 'all 0.2s'
                          }}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  No configurable settings for this service.
                </div>
              )}
            </div>

            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button
                onClick={closeSettings}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'transparent',
                  border: '1px solid var(--text-secondary)',
                  color: 'var(--text-secondary)',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '0.5rem 1.5rem',
                  background: 'var(--color-primary)',
                  border: 'none',
                  color: '#000',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Save size={16} />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <h3 style={{
        color: 'var(--text-secondary)',
        fontSize: '0.9rem',
        textTransform: 'uppercase',
        letterSpacing: '2px',
        margin: '0 0 1rem 0',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <span style={{ width: '8px', height: '8px', background: 'var(--color-primary)', borderRadius: '50%', boxShadow: '0 0 10px var(--color-primary)' }}></span>
        Service Status
      </h3>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '1.5rem',
        paddingRight: '10px'
      }}>
        {services.map(service => {
          const status = getServiceStatus(service);
          const isTideBit = service === 'TideBit-DeFi';

          return (
            <div key={service} style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: `1px solid ${isTideBit ? 'rgba(255,255,255,0.1)' : 'rgba(0, 229, 255, 0.1)'}`,
              borderRadius: '12px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.3s ease',
              position: 'relative',
              overflow: 'hidden',
              opacity: isTideBit ? 0.7 : 1,
              filter: isTideBit ? 'grayscale(0.8)' : 'none'
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '4px',
                height: '100%',
                background: status === 'RUNNING' ? '#00E676' : status === 'STOPPED' ? '#FF3D00' : isTideBit ? '#777' : 'var(--text-secondary)'
              }}></div>

              {/* Settings Gear - Disabled for TideBit */}
              {!isTideBit && (
                <button
                  onClick={() => openSettings(service)}
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    opacity: 0.5,
                    transition: 'opacity 0.2s',
                    zIndex: 10
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}
                >
                  <Settings size={18} />
                </button>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{service}</h4>
                  <span style={{
                    fontSize: '0.75rem',
                    color: status === 'RUNNING' ? '#00E676' : status === 'STOPPED' ? '#FF3D00' : '#888',
                    border: `1px solid ${status === 'RUNNING' ? 'rgba(0, 230, 118, 0.2)' : status === 'STOPPED' ? 'rgba(255, 61, 0, 0.2)' : 'rgba(255, 255, 255, 0.1)'}`,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    marginTop: '5px',
                    display: 'inline-block'
                  }}>
                    {status}
                  </span>
                </div>
                <div style={{ opacity: 0.5 }}>
                  {/* Icon placeholder */}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', flexDirection: 'column' }}>
                {service === 'iSunCoin' && (
                  <>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Performance:</span>
                      <span style={{ fontFamily: 'monospace', color: '#B2EBF2', textTransform: 'capitalize' }}>{isuncoinPerf}</span>
                    </div>
                    {balance && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Balance:</span>
                        <span style={{ fontFamily: 'monospace', color: '#00E5FF' }}>{balance}</span>
                      </div>
                    )}
                  </>
                )}
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  {isTideBit ? 'Coming Soon' : (status === 'RUNNING' ? 'Service Active' : 'Auto-starting...')}
                </div>
              </div>
            </div>
          );
        })}

        {services.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', opacity: 0.5, padding: '2rem' }}>
            No services found in services/ directory.
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceStatus;
