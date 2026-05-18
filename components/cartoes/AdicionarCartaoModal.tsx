'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Loader2, CreditCard, AlertCircle, Check } from 'lucide-react';
import { api } from '@/lib/api';

const BRAND = '#61D17B';

// Cores por banco — extraídas do nome da conta vinculada
const CORES_BANCOS: Record<string, { bg: string; text: string }> = {
  nubank:    { bg: '#8A05BE', text: 'NU' },
  inter:     { bg: '#FF7A00', text: 'IN' },
  itau:      { bg: '#EC7000', text: 'IT' },
  bradesco:  { bg: '#CC092F', text: 'BR' },
  santander: { bg: '#EC0000', text: 'SA' },
  caixa:     { bg: '#0070AF', text: 'CX' },
  c6:        { bg: '#1A1A1A', text: 'C6' },
  mercado:   { bg: '#00B1EA', text: 'MP' },
  picpay:    { bg: '#11C76F', text: 'PP' },
  bb:        { bg: '#FAE128', text: 'BB' },
  banco:     { bg: '#FAE128', text: 'BB' },
  safra:     { bg: '#003DA5', text: 'SF' },
};

export function bancoLogo(nome: string): { bg: string; text: string } {
  const lower = (nome || '').toLowerCase();
  for (const [k, v] of Object.entries(CORES_BANCOS)) {
    if (lower.includes(k)) return v;
  }
  // fallback HSL determinístico
  let hash = 0;
  for (let i = 0; i < lower.length; i++) hash = lower.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  const initial = (lower.charAt(0) || '?').toUpperCase();
  return { bg: `hsl(${h} 65% 45%)`, text: initial };
}

const BANDEIRAS = ['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard'] as const;

// Logo SVG simplificado para bandeiras (texto colorido em fundo de marca)
const BANDEIRA_THEMES: Record<typeof BANDEIRAS[number], { bg: string; fg: string }> = {
  Visa:       { bg: '#1A1F71', fg: '#F7B600' },
  Mastercard: { bg: '#EB001B', fg: '#FFFFFF' },
  Elo:        { bg: '#000000', fg: '#FFD200' },
  Amex:       { bg: '#2E77BB', fg: '#FFFFFF' },
  Hipercard:  { bg: '#822124', fg: '#FFFFFF' },
};

export interface CartaoMeta {
  bandeira?: typeof BANDEIRAS[number];
  ultimos4?: string;
  diaFechamento?: number;
  diaVencimento?: number;
}

export function loadCartaoMeta(walletId: string): CartaoMeta {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(`sora-cartao-${walletId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveCartaoMeta(walletId: string, meta: CartaoMeta) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`sora-cartao-${walletId}`, JSON.stringify(meta));
}

interface Props {
  phone: string;
  cartaoExistente?: any | null; // wallet do tipo Crédito (em modo edição)
  onClose: () => void;
  onSuccess: () => void;
}

export default function AdicionarCartaoModal({ phone, cartaoExistente, onClose, onSuccess }: Props) {
  const ediMode = !!cartaoExistente;

  const [contasBancarias, setContasBancarias] = useState<any[]>([]);
  const [contaVinculadaId, setContaVinculadaId] = useState<string>('');
  const [nome,           setNome]              = useState(cartaoExistente?.nome || '');
  const [bandeira,       setBandeira]          = useState<typeof BANDEIRAS[number] | ''>('');
  const [limiteRaw,      setLimiteRaw]         = useState(
    cartaoExistente?.limite ? String(Math.round(cartaoExistente.limite * 100)) : ''
  );
  const [ultimos4,       setUltimos4]          = useState('');
  const [diaFechamento,  setDiaFechamento]     = useState<number | ''>('');
  const [diaVencimento,  setDiaVencimento]     = useState<number | ''>('');
  const [loading,        setLoading]           = useState(false);
  const [erro,           setErro]              = useState('');

  // Carrega contas bancárias para o dropdown
  useEffect(() => {
    if (!phone) return;
    api.wallets.listar(phone)
      .then(ws => {
        const naoCredito = (ws || []).filter((w: any) => w.tipo !== 'Crédito');
        setContasBancarias(naoCredito);
      })
      .catch(() => setContasBancarias([]));
  }, [phone]);

  // Carrega metadados existentes em modo edição
  useEffect(() => {
    if (!cartaoExistente) return;
    const meta = loadCartaoMeta(cartaoExistente.id);
    setBandeira(meta.bandeira || '');
    setUltimos4(meta.ultimos4 || '');
    setDiaFechamento(meta.diaFechamento ?? '');
    setDiaVencimento(meta.diaVencimento ?? '');
  }, [cartaoExistente]);

  // Conta selecionada
  const contaSelecionada = useMemo(
    () => contasBancarias.find(c => c.id === contaVinculadaId),
    [contasBancarias, contaVinculadaId]
  );

  // Auto-preenche o nome ao trocar conta vinculada
  useEffect(() => {
    if (!contaSelecionada) return;
    if (ediMode) return;
    setNome(`${contaSelecionada.nome} Crédito`);
  }, [contaSelecionada, ediMode]);

  const limiteFmt = (() => {
    if (!limiteRaw) return '0,00';
    return (parseInt(limiteRaw, 10) / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  })();

  function handleLimite(e: React.ChangeEvent<HTMLInputElement>) {
    setLimiteRaw(e.target.value.replace(/\D/g, ''));
  }

  function handleUltimos4(e: React.ChangeEvent<HTMLInputElement>) {
    setUltimos4(e.target.value.replace(/\D/g, '').slice(0, 4));
  }

  async function handleSalvar() {
    setErro('');
    if (!ediMode && !contaVinculadaId) {
      setErro('Selecione uma conta bancária vinculada.');
      return;
    }
    if (!nome.trim()) {
      setErro('Informe um nome para o cartão.');
      return;
    }
    if (!limiteRaw || limiteRaw === '0') {
      setErro('Informe o limite do cartão.');
      return;
    }

    setLoading(true);
    try {
      const limite = parseInt(limiteRaw, 10) / 100;

      const walletPayload: any = {
        phone,
        nome: nome.trim(),
        tipo: 'Crédito',
        limite,
      };
      if (ediMode) walletPayload.id = cartaoExistente.id;

      const saved: any = await api.wallets.salvar(walletPayload);
      const walletId = saved?.id || saved?.wallet?.id || cartaoExistente?.id;

      if (walletId) {
        saveCartaoMeta(walletId, {
          bandeira: bandeira || undefined,
          ultimos4: ultimos4 || undefined,
          diaFechamento: typeof diaFechamento === 'number' ? diaFechamento : undefined,
          diaVencimento: typeof diaVencimento === 'number' ? diaVencimento : undefined,
        });
      }

      onSuccess();
      onClose();
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar cartão.');
    } finally {
      setLoading(false);
    }
  }

  const logoDoNome = bancoLogo(nome || contaSelecionada?.nome || '');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-lg bg-card rounded-3xl shadow-2xl overflow-hidden animate-fade-in border border-border"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
              style={{ background: logoDoNome.bg }}
            >
              {nome || contaSelecionada ? logoDoNome.text : <CreditCard size={18} />}
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground leading-tight">
                {ediMode ? 'Editar cartão' : 'Adicionar cartão'}
              </h2>
              <p className="text-xs text-muted-foreground">
                Vincule a uma conta bancária existente
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">

          {/* Conta bancária vinculada — só em modo criação */}
          {!ediMode && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Conta bancária vinculada *
              </label>
              {contasBancarias.length === 0 ? (
                <div className="rounded-xl p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex items-start gap-2.5">
                  <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                    Você precisa ter pelo menos uma conta bancária (corrente, poupança ou dinheiro) cadastrada para criar um cartão.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {contasBancarias.map(c => {
                    const logo = bancoLogo(c.nome);
                    const ativa = c.id === contaVinculadaId;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setContaVinculadaId(c.id)}
                        className={`relative flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                          ativa
                            ? 'border-primary bg-primary/5 shadow-glow-sm'
                            : 'border-border bg-muted/30 hover:border-primary/40'
                        }`}
                      >
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: logo.bg }}
                        >
                          {logo.text}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{c.nome}</p>
                          <p className="text-[11px] text-muted-foreground">{c.tipo}</p>
                        </div>
                        {ativa && (
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                            <Check size={12} className="text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Nome do cartão */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Nome do cartão
            </label>
            <input
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Nubank Platinum"
              className="input"
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Personalize com o nome do produto (ex: "Platinum", "Gold", "Black").
            </p>
          </div>

          {/* Bandeira */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Bandeira
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {BANDEIRAS.map(b => {
                const ativa = bandeira === b;
                const theme = BANDEIRA_THEMES[b];
                return (
                  <button
                    key={b}
                    onClick={() => setBandeira(ativa ? '' : b)}
                    className={`relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all ${
                      ativa
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-muted/30 hover:border-primary/40'
                    }`}
                  >
                    <div
                      className="w-full h-7 rounded-md flex items-center justify-center font-bold text-[10px] tracking-wide"
                      style={{ background: theme.bg, color: theme.fg }}
                    >
                      {b.toUpperCase()}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{b}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Limite + Últimos 4 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Limite do cartão *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">R$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={limiteFmt}
                  onChange={handleLimite}
                  className="input pl-10 tabular text-right text-base font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Últimos 4 dígitos
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="••••"
                value={ultimos4}
                onChange={handleUltimos4}
                maxLength={4}
                className="input tabular tracking-widest text-center text-base"
              />
            </div>
          </div>

          {/* Fechamento + Vencimento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Dia de fechamento
              </label>
              <select
                value={diaFechamento}
                onChange={e => setDiaFechamento(e.target.value ? parseInt(e.target.value, 10) : '')}
                className="input"
              >
                <option value="">Selecione</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>Dia {d}</option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Dia em que a fatura é fechada.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Dia de vencimento
              </label>
              <select
                value={diaVencimento}
                onChange={e => setDiaVencimento(e.target.value ? parseInt(e.target.value, 10) : '')}
                className="input"
              >
                <option value="">Selecione</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>Dia {d}</option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Dia em que a fatura precisa ser paga.
              </p>
            </div>
          </div>

          {/* Erro */}
          {erro && (
            <div className="rounded-xl p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5">
              <AlertCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">{erro}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={loading}
            className="btn btn-primary px-4 py-2 text-sm gap-2 shadow-glow-sm"
            style={{ background: BRAND }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {ediMode ? 'Salvar alterações' : 'Salvar cartão'}
          </button>
        </div>
      </div>
    </div>
  );
}
