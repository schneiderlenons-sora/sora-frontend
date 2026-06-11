import type { NextConfig } from "next";

const nextConfig = {
  // Build de produção nao bloqueia em erros de TS/ESLint.
  // VS Code continua mostrando erros normalmente em dev.
  typescript: { ignoreBuildErrors: true },
  eslint:     { ignoreDuringBuilds: true },
} as NextConfig;

export default nextConfig;
