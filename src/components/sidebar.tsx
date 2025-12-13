'use client';

import React from 'react';
import Link from 'next/link';
import { LayoutDashboard, ShoppingBag, Server, Activity, Settings } from 'lucide-react';

interface SidebarProps {
  activeView?: string;
}

// Info: (20251214 - AI) Server Component is fine here, or Client if we need usage of hooks
// Info: (20251214 - AI) For active state highlighting, we likely need usePathname in a Client Component wrapper,
// Info: (20251214 - AI) or just make this a client component.

import { usePathname } from 'next/navigation';

import icon from '@/assets/icon.png';

const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const [version, setVersion] = React.useState('v0.0.0');

  React.useEffect(() => {
    const fetchVersion = async () => {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const ver = await window.electronAPI.getIsuncoinVersion();
        setVersion(ver);
      }
    };
    fetchVersion();
  }, []);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
    { id: 'marketplace', label: 'Service Marketplace', path: '/marketplace', icon: <ShoppingBag size={20} />, disabled: true },
    { id: 'services', label: 'My Services', path: '/services', icon: <Server size={20} />, disabled: true },
    { id: 'monitor', label: 'Node Monitor', path: '/monitor', icon: <Activity size={20} />, disabled: true },
    { id: 'settings', label: 'Settings', path: '/settings', icon: <Settings size={20} />, disabled: true }
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div
          className="logo-circle"
          style={{
            backgroundImage: `url(${icon.src})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        ></div>
        <h2>iSunCloud</h2>
      </div>

      <nav>
        <ul>
          {menuItems.map(item => (
            <li
              key={item.id}
              className={pathname === item.path ? 'active' : ''}
              style={item.disabled ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
            >
              {item.disabled ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', height: '100%', color: 'inherit' }}>
                  {item.icon}
                  <span>{item.label}</span>
                  <span style={{
                    fontSize: '0.6rem',
                    border: '1px solid var(--text-secondary)',
                    borderRadius: '4px',
                    padding: '2px 4px',
                    marginLeft: 'auto',
                    color: 'var(--text-secondary)'
                  }}>SOON</span>
                </div>
              ) : (
                <Link href={item.path} style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', height: '100%', color: 'inherit', textDecoration: 'none' }}>
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-footer" style={{ marginTop: 'auto' }}>
        <div style={{ marginTop: '10px', fontSize: '12px', opacity: 0.5, textAlign: 'center' }}>
          {version}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
