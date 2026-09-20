import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // O Dockerfile define NEXT_OUTPUT=standalone para gerar a imagem enxuta.
  // Fora do Docker, `next start` funciona normalmente.
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  // Drivers nativos de Node: não devem ser empacotados pelo bundler.
  serverExternalPackages: ['pg', 'ioredis'],
  poweredByHeader: false,
};

export default nextConfig;
