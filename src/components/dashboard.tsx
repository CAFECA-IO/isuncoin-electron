import React, { useEffect, useState } from 'react';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({ cpu: 0, ram: 0, disk: 0, gpu: 0 });
  const [flops, setFlops] = useState<string>('---');

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const runBench = async () => {
      if (typeof window === 'undefined' || !window.electronAPI) return;
      try {
        const res = await window.electronAPI.getFlops();
        if (res.success && res.data) {
          const match = res.data.match(/Total Compute Power:\s*([\d.]+)\s*TFLOPS/);
          setFlops(match ? `${match[1]} TFLOPS` : 'Unknown');
        } else {
          setFlops('N/A');
        }
      } catch (e) {
        console.error('Failed to get flops:', e);
      }
    };
    // Run once on mount
    runBench();

    const updateStats = async () => {
      if (typeof window === 'undefined' || !window.electronAPI) return;
      try {
        const sys = await window.electronAPI.getSystemStats();
        if (sys) {
          // Mock GPU if 0, similar to previous implementation for demo visualization
          const gpuVal = sys.gpu > 0 ? sys.gpu : Math.random() * 10 + 20;
          setStats({
            cpu: sys.cpu,
            ram: sys.ram,
            disk: sys.disk,
            gpu: gpuVal
          });
        }
      } catch (e) {
        console.error('Failed to fetch stats:', e);
      }
    };

    updateStats();
    intervalId = setInterval(updateStats, 2000);
    return () => clearInterval(intervalId);
  }, []);

  const [services, setServices] = useState<string[]>([]);
  const [containers, setContainers] = useState<any[]>([]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const fetchServicesData = async () => {
      if (typeof window === 'undefined' || !window.electronAPI) return;
      try {
        const defined = await window.electronAPI.getDefinedServices();
        const currentContainers = await window.electronAPI.getDockerContainers();
        setServices(defined);
        setContainers(currentContainers);
      } catch (e) {
        console.error('Failed to fetch services:', e);
      }
    };

    fetchServicesData();
    interval = setInterval(fetchServicesData, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  const getServiceStatus = (serviceName: string) => {
    // Docker container names often differ, but we used --name=serviceName in deploy
    const container = containers.find(c => c.names === serviceName || c.names.includes(serviceName));
    if (!container) return 'NOT DEPLOYED';
    if (container.status.startsWith('Up')) return 'RUNNING';
    return 'STOPPED';
  };

  const getContainerId = (serviceName: string) => {
    const container = containers.find(c => c.names === serviceName || c.names.includes(serviceName));
    return container ? container.id : null;
  };

  const handleServiceAction = async (serviceName: string, action: 'start' | 'stop' | 'deploy') => {
    if (!window.electronAPI) return;

    if (action === 'deploy') {
      // Add loading state or notification here if needed
      await window.electronAPI.dockerDeploy(serviceName);
    } else {
      const id = getContainerId(serviceName);
      if (id) {
        if (action === 'start') await window.electronAPI.dockerStart(id);
        if (action === 'stop') await window.electronAPI.dockerStop(id);
      }
    }
    // Refresh immediately
    const currentContainers = await window.electronAPI.getDockerContainers();
    setContainers(currentContainers);
  };

  const BarItem = ({ label, value, color }: { label: string, value: number, color: string }) => (
    <div className="bar-item" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontFamily: "'Courier New', monospace" }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{label}</span>
        <span style={{ color: color, fontWeight: 'bold' }}>{value.toFixed(1)}%</span>
      </div>
      <div className="bar-bg" style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', overflow: 'hidden' }}>
        <div
          className="bar-fill"
          style={{
            width: `${value}%`,
            height: '100%',
            background: color,
            boxShadow: `0 0 10px ${color}`,
            transition: 'width 0.5s ease-out'
          }}
        ></div>
      </div>
    </div>
  );

  return (
    <div id="view-dashboard" className="view-section active" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Top 25% - System Load Bars */}
      <div className="system-bars-section" style={{
        minHeight: '180px',
        background: 'var(--card-bg)',
        border: '1px solid rgba(0, 229, 255, 0.1)',
        borderRadius: '12px',
        padding: '1.5rem',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-around',
        marginBottom: '2rem'
      }}>
        <div style={{
          marginBottom: '1rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          paddingBottom: '0.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            margin: 0
          }}>System Load Status</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-accent)', opacity: 0.8 }}>COMPUTE POWER:</span>
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--color-primary)', fontFamily: "'Courier New', monospace", textShadow: '0 0 10px rgba(0, 229, 255, 0.3)' }}>
              {flops}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', height: '100%', gap: '2rem' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <BarItem label="CPU Usage" value={stats.cpu} color="#00E5FF" />
            <BarItem label="RAM Usage" value={stats.ram} color="#00E676" />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <BarItem label="Disk Usage" value={stats.disk} color="#7B61FF" />
            <BarItem label="GPU Usage" value={stats.gpu} color="#FFD700" />
          </div>
        </div>
      </div>

      {/* Lower Half: Services Status */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
            return (
              <div key={service} style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(0, 229, 255, 0.1)',
                borderRadius: '12px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '4px',
                  height: '100%',
                  background: status === 'RUNNING' ? '#00E676' : status === 'STOPPED' ? '#FF3D00' : 'var(--text-secondary)'
                }}></div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{service}</h4>
                    <span style={{
                      fontSize: '0.75rem',
                      color: status === 'RUNNING' ? '#00E676' : status === 'STOPPED' ? '#FF3D00' : 'var(--text-secondary)',
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
                    {/* Icon placeholder or specialized icon based on service name */}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                  {status === 'NOT DEPLOYED' ? (
                    <button
                      onClick={() => handleServiceAction(service, 'deploy')}
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        background: 'rgba(0, 229, 255, 0.1)',
                        border: '1px solid rgba(0, 229, 255, 0.3)',
                        color: 'var(--color-primary)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        transition: 'background 0.2s'
                      }}
                    >
                      DEPLOY
                    </button>
                  ) : (
                    <>
                      {status === 'STOPPED' && (
                        <button
                          onClick={() => handleServiceAction(service, 'start')}
                          style={{
                            flex: 1,
                            padding: '0.5rem',
                            background: 'rgba(0, 230, 118, 0.1)',
                            border: '1px solid rgba(0, 230, 118, 0.3)',
                            color: '#00E676',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 'bold'
                          }}
                        >
                          START
                        </button>
                      )}
                      {status === 'RUNNING' && (
                        <button
                          onClick={() => handleServiceAction(service, 'stop')}
                          style={{
                            flex: 1,
                            padding: '0.5rem',
                            background: 'rgba(255, 61, 0, 0.1)',
                            border: '1px solid rgba(255, 61, 0, 0.3)',
                            color: '#FF3D00',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 'bold'
                          }}
                        >
                          STOP
                        </button>
                      )}
                      {/* Optional Redeploy or Logs button could go here */}
                    </>
                  )}
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
    </div>
  );
};

export default Dashboard;
