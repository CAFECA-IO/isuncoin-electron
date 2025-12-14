import React from 'react';
import SystemLoad from '@/components/dashboard/system_load';
import ServiceStatus from '@/components/dashboard/service_status';

const Dashboard: React.FC = () => {
  return (
    <div id="view-dashboard" className="view-section active" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <SystemLoad />
      <ServiceStatus />
    </div>
  );
};

export default Dashboard;
