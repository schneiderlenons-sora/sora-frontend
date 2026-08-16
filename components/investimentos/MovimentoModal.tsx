'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, ArrowDownCircle, ArrowUpCircle, Check } from 'lucide-react';
import { api } from '@/lib/api';

// =============================================================================
// Aporte e RESGATE de investimento — o mesmo modal, dois sentidos.
//
// Relato de usuário: "não achei a opção de resgate de investimentos na
// plataforma, e nem de aporte". O aporte existia por WhatsApp e tinha rota, mas
// o painel só LISTAVA; o resgate não existia em lugar nenhum.
//
// ⚠️ VIA PORTAL, sempre: os cards do painel usam `backdrop-blur`, e um
// ancestral com backdrop-filter vira o containing block de `position: fixed` —
// o modal ficaria preso dentro do card, atrás do conteúdo. z-index não resolve.
// (Regra do CLAUDE.md, bug real do PagarFaturaModal.)
// =============================================================================

const BRAND = 'hsl(var(--primary))';
const COR_RESGATE = '#f97316';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

type Investimento = { id: string; nome: string; valor_atual?: number | null };
type Conta        = { id: string; nome: string; tipo?: string | null };

export default function MovimentoModal({
  tipo, phone, investimentos, investimentoId, onClose, onSuccess,
}: {
  tipo: 'aporte' | 'resgate';
  phone: string;
  investimentos: Investimento[];
  investimentoId?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const ehAporte = tipo === 'aporte';
  const cor = ehAporte ? BRAND : COR_RESGATE;

  const [montado, setMontado] = useState(false);
  const [invId, setInvId]     = useState(investimentoId || investimentos[0]?.id || '');
  const [valor, setValor]     = useState('');
  const [obs, setObs]         = useState('');
  const [walletId, setWalletId] = useState('');
  const [contas, setContas]   = useState<Conta[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro]       = useState('');

  useEffect(() => setMontado(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [onClose]);

  // Contas pro débito (aporte) ou crédito (resgate) — cartão de crédito fora.
  useEffect(() => {
    if (!phone) return;
    let vivo = true;
    api.wallets.listar(phone)
      .then((ws: Conta[]) => { if (vivo) setContas((ws || []).filter((w) => w.tipo !== 'Crédito')); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [phone]);

  const inv = useMemo(() => investimentos.find((i) => i.id === invId), [investimentos, invId]);
  const disponivel = Number(inv?.valor_atual) || 0;
  const v = parseFloat((valor || '').replace(',', '.'));
  const excede = !ehAporte && Number.isFinite(v) && v > disponivel + 0.01;

  async function salvar() {
    setErro('');
    if (!invId) { setErro('Escolha o investimento.'); return; }
    if (!Number.isFinite(v) || v <= 0) { setErro('Informe um valor maior que zero.'); return; }
    if (excede) { setErro(`Você só tem ${fmt(disponivel)} nesse investimento.`); return; }

    setLoading(true);
    try {
      const body: Record<string, unknown> = { phone, investimento_id: invId, valor: v };
      if (obs.trim()) body.descricao = obs.trim();
      if (walletId) body.wallet_id = walletId;
      if (ehAporte) await api.investimentos.aportes.criar(body);
      else          await api.investimentos.aportes.resgatar(body as unknown as { investimento_id: string; valor: number });
      onSuccess();
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : `Não consegui registrar o ${tipo}.`);
    } finally {
      setLoading(false);
    }
  }

  if (!montado) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fade-in_200ms_ease-out]"
           onClick={onClose} aria-hidden="true" />

      <div role="dialog" aria-modal="true" aria-labelledby="mov-titulo"
           className="relative w-full sm:max-w-md max-h-[88dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-border/60 shadow-2xl animate-[slide-up_280ms_ease-out]"
           style={{ background: 'hsl(var(--bg-card))' }}>

        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                 style={{ background: `color-mix(in srgb, ${cor} 13%, transparent)` }}>
              {ehAporte ? <ArrowUpCircle size={21} style={{ color: cor }} />
                        : <ArrowDownCircle size={21} style={{ color: cor }} />}
            </div>
            <div className="min-w-0">
              <h2 id="mov-titulo" className="text-lg font-bold text-foreground leading-tight">
                {ehAporte ? 'Novo aporte' : 'Resgatar'}
              </h2>
              <p className="text-[12px] text-muted-foreground">
                {ehAporte ? 'Adicionar dinheiro a um investimento' : 'Tirar dinheiro de um investimento'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar"
                  className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 pt-2 space-y-4">
          {investimentos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Você ainda não tem investimentos cadastrados. Crie um primeiro em
              {' '}<strong className="text-foreground">Novo investimento</strong>.
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <label htmlFor="mov-inv" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Investimento
                </label>
                <select id="mov-inv" value={invId} onChange={(e) => { setInvId(e.target.value); setErro(''); }}
                        className="w-full px-3.5 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                        style={{ minHeight: 48 }}>
                  {investimentos.map((i) => (
                    <option key={i.id} value={i.id}>{i.nome} — {fmt(i.valor_atual)}</option>
                  ))}
                </select>
                {!ehAporte && inv && (
                  <p className="text-[12px] text-muted-foreground tabular-nums">
                    Disponível: <strong className="text-foreground">{fmt(disponivel)}</strong>
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="mov-valor" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  {ehAporte ? 'Quanto está aplicando' : 'Quanto está resgatando'}
                </label>
                <div className="flex items-center gap-2">
                  <input id="mov-valor" inputMode="decimal" autoFocus
                         value={valor} onChange={(e) => { setValor(e.target.value); setErro(''); }}
                         placeholder="R$ 0,00"
                         className="flex-1 px-3.5 rounded-xl bg-background border border-border text-sm tabular-nums text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
                         style={{ minHeight: 48 }} />
                  {!ehAporte && disponivel > 0 && (
                    <button type="button" onClick={() => { setValor(String(disponivel)); setErro(''); }}
                            className="px-3.5 rounded-xl text-[12px] font-bold whitespace-nowrap border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                            style={{ minHeight: 48 }}>
                      Tudo
                    </button>
                  )}
                </div>
                {excede && (
                  <p className="text-[12px] text-red-600 dark:text-red-400">
                    Maior que o disponível ({fmt(disponivel)}).
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="mov-conta" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  {ehAporte ? 'Descontar de qual conta' : 'Creditar em qual conta'} <span className="font-medium normal-case tracking-normal text-muted-foreground/70">· opcional</span>
                </label>
                <select id="mov-conta" value={walletId} onChange={(e) => setWalletId(e.target.value)}
                        className="w-full px-3.5 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                        style={{ minHeight: 48 }}>
                  <option value="">Não mexer em nenhuma conta</option>
                  {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <p className="text-[11.5px] leading-snug text-muted-foreground">
                  {ehAporte
                    ? 'Escolhendo uma conta, a Sora debita o saldo e registra a saída nas transações.'
                    : 'Escolhendo uma conta, a Sora credita o saldo e registra a entrada — marcada como transferência, porque resgate não é renda nova.'}
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="mov-obs" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Observação <span className="font-medium normal-case tracking-normal text-muted-foreground/70">· opcional</span>
                </label>
                <input id="mov-obs" value={obs} onChange={(e) => setObs(e.target.value)}
                       placeholder={ehAporte ? 'Ex.: aporte mensal' : 'Ex.: usei pra entrada do carro'}
                       className="w-full px-3.5 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
                       style={{ minHeight: 48 }} />
              </div>

              {erro && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{erro}</p>}

              <button type="button" onClick={salvar} disabled={loading || !valor || excede}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl font-bold text-white transition active:scale-[0.99] disabled:opacity-50"
                      style={{ background: cor, minHeight: 48 }}>
                {loading ? <><Loader2 size={17} className="animate-spin" /> Salvando…</>
                         : <><Check size={17} /> {ehAporte ? 'Registrar aporte' : 'Registrar resgate'}</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
