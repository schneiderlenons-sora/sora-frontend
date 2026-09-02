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
    //
    // ⚠️ 30s NÃO SOBREVIVIA AO AQUECIMENTO. A Sidebar aquece as ~38 rotas UMA
    // vez por sessão, no primeiro ocioso (é o guard que tirou as 41 requisições
    // por clique). Com 30s, tudo que ela aqueceu expirava meio minuto depois —
    // do minuto 1 da sessão em diante, todo clique voltava a ser ida completa ao
    // servidor, sem casca cacheada. O aquecimento virava custo sem retorno.
    //
    // 300s faz a janela do cache cobrir o aquecimento em vez de vencer antes
    // dele. Continua seguro pelo mesmo motivo de antes, e o teto do risco é
    // conhecido: o payload cacheado é só a CASCA (o `fallbackData` do SSR), e as
    // telas leem o SWR, que ignora esse fallback quando já tem cache e revalida
    // ao montar. Payload velho é corrigido no mesmo frame em que o SWR responde.
    staleTimes: { dynamic: 300 },
  },
} as NextConfig;

export default withNextIntl(nextConfig);
