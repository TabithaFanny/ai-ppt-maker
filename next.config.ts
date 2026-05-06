import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow local file access for uploads
  serverExternalPackages: ['pdfjs-dist', 'mammoth', 'pdf-lib', 'sharp'],
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
