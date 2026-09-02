import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

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

    // ⚠️ SEM ISTO O CACHE DE ROTA NÃO EXISTE. O default do Next 16 é
    // `dynamic: 0`, e TODAS as rotas do painel são dinâmicas (`ƒ` no build,
    // por causa do SSR por aba). Com 0, o Router Cache do cliente descarta o
    // payload RSC assim que ele chega:
    //   · voltar pra uma aba que você acabou de visitar refazia a ida ao
    //     servidor inteira — sessão, lookup e query de novo;
    //   · e o aquecimento da Sidebar (~38 rotas) era jogado fora sem nunca
    //     ter sido aproveitado, ou seja, custo puro.
    //
    // 30s é o valor que o próprio Next usava como padrão antes de zerá-lo, e
    // aqui é seguro porque o dado exibido NÃO vem do payload cacheado: as
    // telas leem o SWR (lib/useApi), que ignora o `fallbackData` do SSR quando
    // já tem cache e revalida ao montar. O RSC cacheado devolve a CASCA
    // instantaneamente; o número na tela continua vindo do SWR.
    //
    // `static` fica no default (300s) de propósito — não há rota estática no
    // painel, então mexer nele seria mudança inerte.
    staleTimes: { dynamic: 30 },
  },
} as NextConfig;

export default withNextIntl(nextConfig);
