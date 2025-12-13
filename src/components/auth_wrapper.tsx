'use client';

import React, { useState } from 'react';
import LockScreen from '@/components/lock_screen';

const AuthWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  if (!isAuthenticated) {
    return <LockScreen onUnlock={() => setIsAuthenticated(true)} />;
  }

  return (
    <>
      {children}
    </>
  );
};

export default AuthWrapper;
