import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build de produção nao bloqueia em erros de TS/ESLint.
  // VS Code continua mostrando erros normalmente em dev.
  typescript: { ignoreBuildErrors: true },
  eslint:     { ignoreDuringBuilds: true },
};

export default nextConfig;
