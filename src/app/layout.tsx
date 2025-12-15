import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/sidebar';

export const metadata: Metadata = {
  title: 'iSunCloud',
  description: 'iSunCoin AI Blockchain Desktop Application',
};

import AuthWrapper from '@/components/auth_wrapper';
import DockerCheckWrapper from '@/components/docker_check_wrapper';

import DebugConsole from '@/components/debug_console';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthWrapper>
          <div className="app-container">
            <Sidebar />
            <main className="main-content">
              <DockerCheckWrapper>
                <div>
                  {children}
                </div>
              </DockerCheckWrapper>
            </main>
            <DebugConsole />
          </div>
        </AuthWrapper>
      </body>
    </html>
  );
}
