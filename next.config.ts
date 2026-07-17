import type { NextConfig } from "next";

const nextConfig = {
  // Build de produção nao bloqueia em erros de TS/ESLint.
  // VS Code continua mostrando erros normalmente em dev.
  typescript: { ignoreBuildErrors: true },
  eslint:     { ignoreDuringBuilds: true },

  experimental: {
    // Importar { Wallet, Plus, ... } de 'lucide-react' arrasta o barrel inteiro
    // (~1000 ícones) pro grafo de módulos. Isso reescreve pra import direto de
    // cada ícone.
    optimizePackageImports: ['lucide-react'],
  },
} as NextConfig;

export default nextConfig;
