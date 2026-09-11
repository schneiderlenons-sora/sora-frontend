'use client';

import Link from 'next/link';
import { Activity, ExternalLink } from 'lucide-react';
import GrowGate from '@/components/grow/GrowGate';
import { useEhAndroid } from '@/lib/useOrigem';

// Saúde é Premium+.
//
// ⚠️ Antes este layout redirecionava pro /planos com um spinner. Virou o mesmo
// `GrowGate` das outras abas, que mostra o card de convite NO lugar da aba —
// dizendo o nome dela e o que ela faz, em vez de largar a pessoa numa tabela
// de preços sem contexto. A sub-nav das seções não vive aqui (era sticky e
// "arrastava"): cada página renderiza <SaudeNav /> abaixo do próprio título.
//
// ── FORA DO APP ANDROID ─────────────────────────────────────────────────────
//
// ⚠️ ISTO É CONFORMIDADE DE LOJA, NÃO PREFERÊNCIA DE PRODUTO. A política de
// requisitos do Play Console exige conta de ORGANIZAÇÃO (CNPJ + D-U-N-S) pra
// distribuir "health apps, such as Medical apps", e a Sora é publicada por
// conta PESSOAL. O app Android é um TWA que embrulha o site inteiro, então a
// declaração de recursos de saúde do Play Console tinha de marcar "controle de
// medicamentos e tratamentos" (grupo Medicina) — e era isso que reprovava o
// app. Medido: dois envios recusados em 10/09/2026, o segundo em 11 minutos
// (checagem automática), já com a categoria corrigida pra Produtividade.
//
// ⚠️ A ORDEM IMPORTA: primeiro o app deixa de oferecer, DEPOIS a declaração
// muda. Desmarcar a caixa com a aba no ar seria declaração falsa ao Google —
// e o preço disso não é outra rejeição, é suspensão da conta.
//
// ⚠️ E TEM DE SER AQUI, não só na sidebar: o item some da lista, mas a rota
// continua alcançável por link direto, histórico e URL digitada. Esconder o
// menu e deixar a porta aberta não tornaria a declaração verdadeira.
//
// No NAVEGADOR nada muda — quem quiser a Saúde acessa por forsora.com normal.
export default function SaudeLayout({ children }: { children: React.ReactNode }) {
  const ehAndroid = useEhAndroid();

  if (ehAndroid) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <div
          className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4"
          style={{ background: 'hsl(var(--bg-card) / 0.6)' }}
        >
          <Activity size={26} className="text-muted-foreground" aria-hidden />
        </div>
        <h1 className="text-xl font-bold text-foreground">Saúde fica no site</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Remédios, nutrição e acompanhamento corporal não fazem parte do
          aplicativo. Seus dados continuam salvos — é só abrir a Sora pelo
          navegador para usar essa parte.
        </p>
        <a
          href="https://www.forsora.com/grow/saude"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Abrir no navegador <ExternalLink size={15} aria-hidden />
        </a>
        <div className="mt-4">
          <Link href="/grow" className="text-sm text-muted-foreground underline underline-offset-4">
            Voltar para o Grow
          </Link>
        </div>
      </div>
    );
  }

  return <GrowGate feature="grow_saude">{children}</GrowGate>;
}
