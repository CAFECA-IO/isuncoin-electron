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

      {/* Rest of the dashboard content placeholder */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
        <p>Waiting for additional modules...</p>
      </div>
    </div>
  );
};

export default Dashboard;
