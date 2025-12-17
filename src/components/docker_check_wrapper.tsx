'use client';

import React, { useEffect, useState } from 'react';
import DockerInstallPrompt from './docker_install_prompt';
import { Loader2 } from 'lucide-react';

const DockerCheckWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [checking, setChecking] = useState(true);
  const [dockerStatus, setDockerStatus] = useState<{ installed: boolean; running: boolean } | null>(null);

  const checkDocker = React.useCallback(async () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      try {
        const result = await window.electronAPI.checkDocker();
        setDockerStatus(result);
      } catch (error) {
        console.error("Failed to check docker:", error);
        setDockerStatus({ installed: false, running: false });
      }
    } else {
      // Fallback for development in browser without Electron
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate check delay
      console.warn("Electron API not available, assuming Docker is present for dev.");
      setDockerStatus({ installed: true, running: true });
    }
    setChecking(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkDocker();
  }, [checkDocker]);

  if (checking) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-900 text-white">
        <Loader2 className="mb-4 size-10 animate-spin text-blue-500" />
        <p className="text-gray-400">Checking system requirements...</p>
      </div>
    );
  }

  if (!dockerStatus?.installed) {
    return <DockerInstallPrompt mode="install" onCheckAgain={() => {
      setChecking(true);
      checkDocker();
    }} />;
  }

  if (!dockerStatus?.running) {
    return <DockerInstallPrompt mode="start" onCheckAgain={() => {
      setChecking(true);
      checkDocker();
    }} />;
  }

  return <>{children}</>;
};

export default DockerCheckWrapper;
