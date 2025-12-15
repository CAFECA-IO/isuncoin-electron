'use client';

import React from 'react';
import { Download, RefreshCw, XCircle } from 'lucide-react';

const DockerInstallPrompt: React.FC<{ onCheckAgain: () => void }> = ({ onCheckAgain }) => {
  const handleDownload = () => {
    window.open('https://www.docker.com/products/docker-desktop/', '_blank');
  };

  const handleQuit = async () => {
    if (window.electronAPI) {
      await window.electronAPI.quitApp();
    }
  };

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-gray-900 p-8 text-white">
      <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-800 p-8 text-center shadow-2xl">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-blue-500/10 p-4">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="size-16 text-blue-400"
            >
              {/* Simple Docker-like icon representation */}
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v-2.38c0-.66.45-1.22 1.09-1.36L12 10l6.91 2.26c.64.14 1.09.7 1.09 1.36V16m-16 0h16m-16 0v4h16v-4M8 10V6a2 2 0 012-2h4a2 2 0 012 2v4" />
            </svg>
          </div>
        </div>

        <h2 className="mb-4 text-2xl font-bold">Docker Required</h2>

        <p className="mb-8 leading-relaxed text-gray-300">
          iSunCloud requires Docker to run its services. We couldn&apos;t detect a running Docker installation on your system.
        </p>

        <div className="flex flex-col gap-4">
          <button
            onClick={handleDownload}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Download size={20} />
            Download Docker Desktop
          </button>

          <button
            onClick={onCheckAgain}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-600 bg-gray-700 px-4 py-3 font-medium text-white transition-colors hover:bg-gray-600"
          >
            <RefreshCw size={20} />
            Check Again
          </button>

          <button
            onClick={handleQuit}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium text-red-400 transition-colors hover:bg-red-900/20 hover:text-red-300"
          >
            <XCircle size={20} />
            Quit Application
          </button>
        </div>

        <p className="mt-6 text-xs text-gray-500">
          Already installed? Make sure Docker Desktop is currently running.
        </p>
      </div>
    </div>
  );
};

export default DockerInstallPrompt;
