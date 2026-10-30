'use client';

import { useState } from 'react';
import { X, Loader2, AlertCircle, Check, Receipt, Zap, Calendar, ArrowDownRight, Landmark } from 'lucide-react';
import { api } from '@/lib/api';
import ContaDebitoSelect from '@/components/ui/ContaDebitoSelect';
import { useDinheiro, useSimboloMoeda, useMoedaBase } from '@/lib/moeda-base';
import { valorDasUnidades, textoDasUnidades, unidadesDoValor } from '@/lib/moeda';
import { useConciliacaoDividas, diaMes } from '@/components/dividas/SugestoesBaixa';
import type { DebitoEmprestimo } from '@/lib/api';

const TIPOS_PAGAMENTO = [
  { v: 'parcela',       l: 'Parcela',         desc: 'Pagamento mensal regular',     icon: Receipt },
  { v: 'antecipacao',   l: 'Antecipação',     desc: 'Adiantar uma ou mais parcelas', icon: Zap     },
  { v: 'juros_atraso',  l: 'Juros de atraso', desc: 'Multa por parcela atrasada',    icon: Calendar},
] as const;

interface Props {
  phone:    string;
  divida:   any;
  onClose:   () => void;
  onSuccess: (quitada: boolean) => void;
}

export default function PagarParcelaModal({ phone, divida, onClose, onSuccess }: Props) {
  const fmt = useDinheiro({ entrada: 'ouZero' });
  const simbolo = useSimboloMoeda();
  const moeda = useMoedaBase();
  const valorPadrao = divida.valor_parcela || 0;
  const [valorRaw, setValorRaw] = useState<string>(
    valorPadrao ? String(unidadesDoValor(valorPadrao, moeda)) : ''
  );
  const [tipo,    setTipo]    = useState<'parcela' | 'antecipacao' | 'juros_atraso'>('parcela');
  const [data,    setData]    = useState(new Date().toISOString().slice(0, 10));
  const [obs,     setObs]     = useState('');
  const [walletId, setWalletId] = useState<string | null>(null);
  // Débito do extrato que pagou esta parcela (ligar à mão). Com ele escolhido,
  // NADA é descontado de conta nenhuma: o dinheiro já saiu, é aquele débito.
  const [txId, setTxId] = useState<string | null>(null);
  const { data: conc, mutate: mConc } = useConciliacaoDividas(phone);
  const debitos: DebitoEmprestimo[] = (conc?.debitos || [])
    .filter((d) => !d.ligado_ids?.includes(divida.id))
    .slice(0, 8);
  // Juros de atraso não paga parcela: ali o débito escolhido deixa de valer.
  const txAtivo = tipo === 'juros_atraso' ? null : txId;
  const debitoEscolhido = debitos.find((d) => d.id === txAtivo) || null;
  // Débito bem maior que a parcela costuma pagar várias dívidas de uma vez
  // (a Cooperforte debita R$ 1.000,08 por três empréstimos).
  const debitoCobreMais = !!debitoEscolhido && valorPadrao > 0 && debitoEscolhido.valor > valorPadrao * 1.05;

  function escolherDebito(d: DebitoEmprestimo) {
    if (txId === d.id) { setTxId(null); return; }
    setTxId(d.id);
    setData(d.data);
    // Valor do débito só quando ele É desta parcela (até 5%); senão fica o da
    // parcela, que é a parte desta dívida no débito maior.
    if (valorPadrao > 0 && Math.abs(d.valor - valorPadrao) <= valorPadrao * 0.05) {
      setValorRaw(String(unidadesDoValor(d.valor, moeda)));
    }
  }
  const [loading, setLoading] = useState(false);
  const [erro,    setErro]    = useState('');

  const parcelasPagas = divida.parcelas_pagas || 0;
  const parcelasTotal = divida.parcelas_total || 0;
  const numeroAtual = parcelasPagas + 1;
  const restantes = Math.max(0, parcelasTotal - parcelasPagas);
  const ehUltima = numeroAtual >= parcelasTotal && parcelasTotal > 0;

  const fmtBR = (raw: string) => textoDasUnidades(raw ? parseInt(raw, 10) : 0, moeda);

  const valor = valorDasUnidades(parseInt(valorRaw || '0', 10), moeda);

  async function salvar() {
    setErro('');
    if (!valor || valor <= 0) { setErro('Informe o valor pago.'); return; }
    setLoading(true);
    try {
      const r = await api.dividas.pagar(divida.id, {
        phone,
        valor,
        tipo,
        data_pagamento: data,
        observacao: obs.trim()
          || (debitoEscolhido ? `Débito do banco${debitoEscolhido.descricao ? `: ${debitoEscolhido.descricao}` : ''}`.slice(0, 120) : undefined),
        numero_parcela: tipo === 'parcela' || tipo === 'antecipacao' ? numeroAtual : undefined,
        wallet_id: txAtivo ? null : walletId,
        transacao_id: txAtivo,
      });
      if (txAtivo) mConc();
      onSuccess(r.quitada);
      onClose();
    } catch (e: any) {
      setErro(e.message || 'Erro ao registrar pagamento.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden animate-fade-in border border-border max-h-[92dvh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/15">
              <ArrowDownRight size={20} className="text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground leading-tight">Registrar pagamento</h2>
              <p className="text-xs text-muted-foreground truncate">
                em <strong className="text-foreground">{divida.titulo}</strong>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors flex-shrink-0">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto overscroll-contain">
          {/* Contexto da parcela */}
          {parcelasTotal > 0 && tipo === 'parcela' && (
            <div className="rounded-xl p-3 bg-muted/30 border border-border/60">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Parcela</span>
                {ehUltima && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-950/40">
                    <Check size={9} /> Última!
                  </span>
                )}
              </div>
              <p className="text-lg font-bold text-foreground tabular">
                {numeroAtual} <span className="text-muted-foreground/60 font-normal">/ {parcelasTotal}</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{restantes - 1} restante{restantes - 1 === 1 ? '' : 's'} após este pagamento</p>
            </div>
          )}

          {/* Tipo de pagamento */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Tipo
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {TIPOS_PAGAMENTO.map(t => {
                const ativo = tipo === t.v;
                const Icon = t.icon;
                return (
                  <button
                    key={t.v}
                    onClick={() => setTipo(t.v as any)}
                    type="button"
                    title={t.desc}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${
                      ativo
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'border-border bg-muted/20 hover:border-primary/40'
                    }`}
                  >
                    <Icon size={14} className={ativo ? 'text-primary' : 'text-muted-foreground'} />
                    <span className="text-[10px] font-semibold text-foreground leading-tight text-center">{t.l}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Valor */}
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Valor pago</p>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-2xl font-bold text-muted-foreground">{simbolo}</span>
              <input
                inputMode="numeric"
                value={fmtBR(valorRaw)}
                onChange={e => setValorRaw(e.target.value.replace(/\D/g, ''))}
                className="text-4xl font-bold text-foreground bg-transparent border-none outline-none text-center w-full tabular"
                autoFocus
              />
            </div>
            {tipo === 'parcela' && valorPadrao > 0 && valor !== valorPadrao && (
              <p className="text-[11px] text-muted-foreground mt-2">
                Padrão da parcela: <strong className="text-foreground tabular">{fmt(valorPadrao)}</strong>
              </p>
            )}
          </div>

          {/* Data */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Data do pagamento
            </label>
            <input
              type="date"
              value={data}
              onChange={e => setData(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="input"
            />
          </div>

          {/* Observação */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Observação <span className="text-muted-foreground/60 normal-case font-normal">(opcional)</span>
            </label>
            <input
              value={obs}
              onChange={e => setObs(e.target.value)}
              placeholder="Ex: Pago pelo PIX, comprovante salvo"
              maxLength={120}
              className="input"
            />
          </div>

          {/* Já saiu do extrato? — liga o débito do banco a esta parcela */}
          {debitos.length > 0 && tipo !== 'juros_atraso' && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
                <Landmark size={12} /> Já saiu do extrato?
              </p>
              <p className="text-[11px] text-muted-foreground mb-2 leading-relaxed">
                Escolha o débito que pagou esta parcela. Ela fica paga sem descontar de novo do saldo.
              </p>
              <div className="space-y-1.5" role="radiogroup" aria-label="Débito que pagou a parcela">
                {debitos.map((d) => {
                  const sel = txId === d.id;
                  return (
                    <button key={d.id} type="button" role="radio" aria-checked={sel} onClick={() => escolherDebito(d)}
                      className={`w-full text-left rounded-xl px-3 py-2.5 min-h-[44px] flex items-center gap-2.5 transition-colors ${
                        sel ? 'bg-primary/10 ring-1 ring-primary/40' : 'bg-muted/30 hover:bg-muted/60'}`}>
                      <span className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center ${sel ? 'bg-primary' : ''}`}
                            style={{ border: sel ? 'none' : '1.5px solid hsl(var(--muted-foreground) / 0.5)' }}>
                        {sel && <Check size={10} className="text-primary-foreground" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs text-foreground">
                          <strong className="tabular">{fmt(d.valor)}</strong> em <span className="tabular">{diaMes(d.data)}</span>
                          {d.conta && <span className="text-muted-foreground"> · {d.conta}</span>}
                        </span>
                        {d.descricao && <span className="block text-[11px] text-muted-foreground truncate">{d.descricao}</span>}
                        {d.ligado_a.length > 0 && (
                          <span className="block text-[10px] text-muted-foreground">Também usado em: {d.ligado_a.join(', ')}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              {debitoCobreMais && (
                <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                  Este débito é maior que a parcela. Se ele paga mais de uma dívida, registre aqui só a parte desta
                  e use o mesmo débito nas outras.
                </p>
              )}
            </div>
          )}

          {/* Descontar de uma conta — some quando o pagamento já é um débito do extrato */}
          {txAtivo ? (
            <div className="rounded-xl p-3 bg-muted/30 flex items-start gap-2" style={{ border: '1px solid hsl(var(--border) / 0.6)' }}>
              <Check size={14} className="text-primary flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Nenhuma conta será descontada: o débito escolhido já tirou esse dinheiro.
              </p>
            </div>
          ) : (
            <ContaDebitoSelect value={walletId} onChange={setWalletId} />
          )}

          {erro && (
            <div className="rounded-xl p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5">
              <AlertCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">{erro}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20 shrink-0">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
          <button
            onClick={salvar}
            disabled={loading || !valor}
            className="btn btn-primary px-4 py-2 text-sm gap-2 shadow-glow-sm"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Registrar pagamento
          </button>
        </div>
      </div>
    </div>
  );
}
