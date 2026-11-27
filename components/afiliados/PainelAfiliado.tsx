'use client';

import { BotaoCopiar, Totais, NOME_TIPO, diaBR, reais, linkDoAfiliado, situacao } from './comum';

// A tela de quem já é afiliado: o que divulgar e o que tem a receber.

export type DadosAfiliado = {
  codigo: string; desconto_pct: number; ativo: boolean; clientes: number;
  resumo: { aReceber: number; emCarencia: number; recebido: number };
  linhas: { id: string; tipo: string; ajuste: boolean; valor_centavos: number; status: string; pago_em: string; liberada_em: string }[];
};

export default function PainelAfiliado({ dados }: { dados: DadosAfiliado }) {
  const link = linkDoAfiliado(dados.codigo);
  return (
    <div className="space-y-4">
      {!dados.ativo && (
        <p role="status" className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-foreground leading-relaxed">
          Seu código está pausado: ele não dá desconto nem registra clientes novos. As comissões de quem você já trouxe continuam.
        </p>
      )}

      <section className="rounded-3xl border border-border/60 p-5 space-y-4" style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Seu código, com {dados.desconto_pct}% de desconto na primeira cobrança</p>
            <p className="text-2xl font-black text-foreground tracking-wide break-all select-all">{dados.codigo}</p>
          </div>
          <BotaoCopiar texto={dados.codigo} rotulo="Copiar" />
        </div>
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/60">
          <p className="text-sm text-foreground break-all select-all min-w-0">{link}</p>
          <BotaoCopiar texto={link} rotulo="Copiar link" />
        </div>
      </section>

      <p className="text-sm text-muted-foreground px-1">
        {dados.clientes === 0 ? 'Ninguém entrou pelo seu link ou código ainda.'
          : `${dados.clientes} ${dados.clientes === 1 ? 'pessoa veio' : 'pessoas vieram'} pelo seu link ou código.`}
      </p>

      <Totais resumo={dados.resumo} />

      {dados.linhas.length > 0 && (
        <ul className="rounded-2xl border border-border/60 divide-y divide-border/60">
          {dados.linhas.map((l) => {
            const s = situacao(l);
            return (
              <li key={l.id} className="flex items-center justify-between gap-3 p-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{l.ajuste ? 'Ajuste' : NOME_TIPO[l.tipo] || l.tipo}</p>
                  <p className="text-[12px] text-muted-foreground">
                    {diaBR(l.pago_em)} <span className={s.cor}>{s.texto}</span>
                  </p>
                </div>
                <p className="text-sm font-bold text-foreground tabular-nums flex-shrink-0">{reais(l.valor_centavos)}</p>
              </li>
            );
          })}
        </ul>
      )}

      <div className="text-[12px] text-muted-foreground leading-relaxed space-y-1.5 px-1">
        <p>Você ganha 30% da primeira cobrança, 15% de cada renovação por até 2 anos e 30% do plano vitalício, sobre o valor repassado depois das taxas de pagamento.</p>
        <p>Cada comissão libera 30 dias depois da cobrança e é paga por Pix. Reembolso cancela a comissão.</p>
        <p>Contam clientes novos que pagam pelo site. Compras feitas pelas lojas de aplicativo não entram.</p>
      </div>
    </div>
  );
}
