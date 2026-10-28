'use client';

import Link from 'next/link';
import { Check, Crown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PLANO_LABEL, type Plano } from '@/lib/plans';

// A /planos DENTRO DO APP DE IPHONE.
//
// ⚠️ NÃO VENDE NADA E NÃO DIZ ONDE COMPRAR. A Apple exige a cobrança dela pra
// assinatura digital (3.1.1) e proíbe botão, link ou texto que leve a outro
// meio de pagamento (3.1.1 / anti-steering) — "assine pelo site" reprova o app
// do mesmo jeito que um botão do Stripe. Quando a cobrança da Apple for ligada,
// é aqui que ela entra (como a PlanosPlay no Android).
//
// O que sobra é útil de verdade: qual plano a conta tem e o que ele cobre.
const O_QUE_TEM_NO_GRATIS = [
  'Lançamentos de gastos e receitas',
  'Contas bancárias e cartões de crédito',
  'Categorias, limites de gastos e contas fixas',
  'Metas, dívidas e relatórios',
];

/** `dentroDeConfiguracoes`: sem o botão de voltar (lá a seção já está no painel). */
export default function PlanosNoAppIos({ dentroDeConfiguracoes = false }: { dentroDeConfiguracoes?: boolean }) {
  const { plano } = useAuth();
  const p = (plano || 'gratis') as Plano;
  const nome = PLANO_LABEL[p] ?? 'Grátis';
  const pago = p !== 'gratis' && p !== 'inativo';

  return (
    <div className={dentroDeConfiguracoes ? '' : 'max-w-md mx-auto py-10 px-4'}>
      <div
        className="rounded-3xl border border-border/40 backdrop-blur-xl p-6"
        style={{ background: 'hsl(var(--bg-card) / 0.5)' }}
      >
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-primary/10">
          <Crown size={22} className="text-primary" aria-hidden />
        </div>
        <p className="text-sm text-muted-foreground">Seu plano</p>
        <h1 className="text-2xl font-bold text-foreground mt-0.5">{nome}</h1>

        {pago ? (
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Todos os recursos do seu plano estão liberados neste app.
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Com o plano Grátis você organiza seu dinheiro por aqui:
            </p>
            <ul className="mt-3 space-y-2">
              {O_QUE_TEM_NO_GRATIS.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                  <Check size={16} className="text-primary mt-0.5 shrink-0" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </>
        )}

        {!dentroDeConfiguracoes && (
        <Link
          href="/dashboard"
          className="mt-6 flex items-center justify-center w-full min-h-[44px] rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Voltar ao painel
        </Link>
        )}
      </div>
    </div>
  );
}
