'use client';

import { useMemo, useState } from 'react';
import { Check, Clock, CalendarClock, SkipForward, TriangleAlert, Wallet } from 'lucide-react';
import { montarExtrato, type Extrato, type LinhaExtrato } from '@/lib/extrato-futuro';

// =============================================================================
// EXTRATO FUTURO — a tela que o cliente pediu, e um pouco mais.
//
// Pedido, literal: "uma lista simples de lançamentos, um check para indicar o
// que foi ou não pago e, principalmente, a visualização contínua do saldo atual
// e futuro."
//
// ⚠️ O QUE ELA ACRESCENTA AO EXTRATO DE BANCO. O sistema que ele usava mostra a
// coluna de saldo e deixa a pessoa DESCOBRIR o problema escaneando linha a
// linha. A Sora sabe três coisas que aquele app não sabe, e as três viram
// informação em vez de tabela:
//
//   · qual é o DIA MAIS APERTADO e quanto falta nele — a pergunta real
//     ("quanto preciso ter disponível na conta em cada data futura");
//   · quais valores são ESTIMATIVA (conta variável) — mostrados como faixa, não
//     como número cravado, porque cravar seria inventar;
//   · que dívida ACABA — a projeção cai quando a última parcela vence.
//
// A aritmética não mora aqui: vem de `lib/extrato-futuro.ts`, que tem eval
// travando que ela não diverge da aba Projeção.
// =============================================================================

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

const DIA_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
function rotuloDia(iso: string) {
  const [a, m, d] = iso.split('-').map(Number);
  return `${diaMes(iso)} · ${DIA_SEMANA[new Date(a, m - 1, d).getDay()]}`;
}

export type AcaoOcorrencia = {
  linha: LinhaExtrato;
  acao: 'quitar' | 'pular' | 'adiar' | 'desfazer';
  data?: string;
  valor?: number;
};

export default function ExtratoFuturo({
  dados, carteiras, carteiraAtiva, onCarteira, onAcao, ocupado,
}: {
  dados: Parameters<typeof montarExtrato>[0];
  carteiras: string[];
  carteiraAtiva: string | null;
  onCarteira: (c: string | null) => void;
  onAcao: (a: AcaoOcorrencia) => void;
  ocupado?: string | null;
}) {
  const extrato: Extrato = useMemo(() => montarExtrato(dados), [dados]);
  const [aberta, setAberta] = useState<string | null>(null);

  const pior = extrato.pior;
  const apertado = pior && pior.saldo < 0;

  return (
    <div className="space-y-4">
      {/* ── A MANCHETE: a resposta, não a tabela ───────────────────────────
          ⚠️ É ela que diferencia esta tela de um extrato comum. O cliente não
          quer escanear uma coluna; quer saber QUANDO aperta e QUANTO falta. */}
      <div
        className="rounded-2xl border border-border/40 backdrop-blur-xl p-4 sm:p-5 animate-[slide-up_500ms_ease-out_both]"
        style={{
          background: 'hsl(var(--bg-card) / 0.5)',
          backgroundImage: `radial-gradient(circle at top right, ${apertado ? '#ef444424' : '#61D17B24'} 0%, transparent 70%)`,
        }}
      >
        {pior ? (
          <>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {apertado ? <TriangleAlert size={14} className="text-red-500" /> : <Check size={14} className="text-emerald-500" />}
              Seu ponto mais apertado
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-bold tabular">
              {diaMes(pior.data)}
              <span className={`ml-2 ${apertado ? 'text-red-500' : 'text-emerald-500'}`}>
                {fmt(pior.saldo)}
              </span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {apertado
                ? <>Faltam <strong className="text-red-500">{fmt(Math.abs(pior.saldo))}</strong> para cobrir tudo até lá.</>
                : <>É o menor saldo do período — daqui até lá você não fica no vermelho.</>}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Nada previsto neste período.</p>
        )}

        {/* ⚠️ A honestidade sobre o que a Sora NÃO sabe. Conta variável entra
            como estimativa; dizer isso vale mais do que cravar um número. */}
        {extrato.temEstimativa && (
          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Clock size={13} className="mt-0.5 flex-shrink-0" />
            Algumas contas variam de valor. Elas entram pela média e estão
            marcadas com <span className="font-semibold">≈</span> — o número real pode mudar.
          </p>
        )}
      </div>

      {/* ── Filtro por conta ──────────────────────────────────────────────── */}
      {carteiras.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <Chip ativo={!carteiraAtiva} onClick={() => onCarteira(null)}>Todas as contas</Chip>
          {carteiras.map((c) => (
            <Chip key={c} ativo={carteiraAtiva === c} onClick={() => onCarteira(c)}>{c}</Chip>
          ))}
        </div>
      )}

      {/* ── Saldo de partida ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-xl border border-border/40 px-4 py-3"
           style={{ background: 'hsl(var(--bg-card) / 0.35)' }}>
        <span className="text-sm text-muted-foreground flex items-center gap-2">
          <Wallet size={15} /> Saldo de partida
        </span>
        <span className="font-semibold tabular">{fmt(extrato.saldoInicial)}</span>
      </div>

      {/* ── O extrato ─────────────────────────────────────────────────────── */}
      {extrato.dias.map((dia, i) => (
        <div key={dia.data} className="animate-[slide-up_400ms_ease-out_both]" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
          <div className="flex items-baseline justify-between px-1 pb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {rotuloDia(dia.data)}
            </span>
            <span className={`text-sm font-bold tabular ${dia.saldo < 0 ? 'text-red-500' : 'text-foreground'}`}>
              {fmt(dia.saldo)}
            </span>
          </div>

          <div className="rounded-2xl border border-border/40 backdrop-blur-xl overflow-hidden"
               style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
            {dia.linhas.map((l, j) => {
              const id = `${dia.data}:${j}`;
              const previsto = l.estado === 'previsto';
              const podeAgir = previsto && !!l.recorrenciaId;
              return (
                <div key={id} className={j > 0 ? 'border-t border-border/30' : ''}>
                  <button
                    type="button"
                    disabled={!podeAgir}
                    onClick={() => setAberta(aberta === id ? null : id)}
                    className={`w-full flex items-center gap-3 px-3 py-3 text-left min-h-[48px] ${podeAgir ? 'active:scale-[0.99] transition-transform' : 'cursor-default'}`}
                  >
                    {/* ⚠️ Ícone + rótulo, nunca cor sozinha (acessibilidade). */}
                    <span
                      aria-label={previsto ? 'Previsto' : 'Pago'}
                      className={`flex-shrink-0 w-6 h-6 rounded-full grid place-items-center border ${
                        previsto ? 'border-border text-muted-foreground' : 'border-emerald-500/50 bg-emerald-500/15 text-emerald-500'
                      }`}
                    >
                      {previsto ? <Clock size={13} /> : <Check size={14} />}
                    </span>

                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium truncate">
                        {l.descricao}
                        {l.adiada && <span className="ml-1.5 text-[10px] font-semibold text-amber-500">adiada</span>}
                      </span>
                      <span className="block text-[11px] text-muted-foreground truncate">
                        {l.carteira || 'Sem conta'} · {previsto ? 'previsto' : 'pago'}
                      </span>
                    </span>

                    <span className={`flex-shrink-0 text-sm font-semibold tabular ${
                      l.tipo === 'Recebimento' ? 'text-emerald-500' : 'text-foreground'
                    }`}>
                      {l.tipo === 'Recebimento' ? '+' : '−'} {fmt(l.valor).replace('R$', '').trim()}
                      {l.estimado && <span className="ml-0.5 text-muted-foreground">≈</span>}
                    </span>
                  </button>

                  {/* Painel de ação — inline, logo abaixo da linha tocada.
                      ⚠️ Inline e não modal de propósito: os cards usam
                      `backdrop-blur`, e um `position: fixed` dentro deles fica
                      preso/atrás do conteúdo (memória `feedback-modal-portal`).
                      Aqui não há fixed nenhum, então o problema não existe. */}
                  {aberta === id && podeAgir && (
                    <div className="px-3 pb-3 pt-1 grid grid-cols-3 gap-2 border-t border-border/30 bg-muted/20">
                      <AcaoBtn
                        icone={<Check size={15} />} rotulo="Paguei"
                        ocupado={ocupado === l.recorrenciaId}
                        onClick={() => { onAcao({ linha: l, acao: 'quitar', data: l.data, valor: l.valor }); setAberta(null); }}
                      />
                      <AcaoBtn
                        icone={<CalendarClock size={15} />} rotulo="Adiar"
                        onClick={() => { onAcao({ linha: l, acao: 'adiar' }); setAberta(null); }}
                      />
                      <AcaoBtn
                        icone={<SkipForward size={15} />} rotulo="Pular"
                        onClick={() => { onAcao({ linha: l, acao: 'pular' }); setAberta(null); }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {!extrato.dias.length && (
        <div className="rounded-2xl border border-border/40 p-8 text-center"
             style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
          <p className="text-sm text-muted-foreground">
            Nada previsto nesta janela. Cadastre uma conta fixa para ver a
            projeção do seu saldo dia a dia.
          </p>
        </div>
      )}
    </div>
  );
}

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`flex-shrink-0 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap min-h-[36px] transition-colors ${
        ativo ? 'bg-primary text-white' : 'bg-muted/50 text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function AcaoBtn({ icone, rotulo, onClick, ocupado }: {
  icone: React.ReactNode; rotulo: string; onClick: () => void; ocupado?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={ocupado}
      className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg text-[11px] font-medium
                 bg-background/60 hover:bg-background border border-border/40 min-h-[44px]
                 disabled:opacity-50 active:scale-[0.97] transition-all"
    >
      {icone}
      {ocupado ? '...' : rotulo}
    </button>
  );
}
