/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export", // Info: (20251214 - AI) Static HTML export for Electron
  distDir: "dist_renderer", // Info: (20251214 - AI) Output directory
  images: {
    unoptimized: true, // Info: (20251214 - AI) No server-side image optimization
  },
  assetPrefix: '.',
};

export default nextConfig;
