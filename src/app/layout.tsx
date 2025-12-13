import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/sidebar';

export const metadata: Metadata = {
  title: 'iSunCloud',
  description: 'iSunCoin AI Blockchain Desktop Application',
};

import AuthWrapper from '@/components/auth_wrapper';

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
              <div className="content-area">
                {children}
              </div>
            </main>
          </div>
        </AuthWrapper>
      </body>
    </html>
  );
}
