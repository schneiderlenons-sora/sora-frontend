'use client';

import { useState } from 'react';
import { X, Loader2, AlertCircle, Check, ChevronLeft, Shield } from 'lucide-react';
import { api } from '@/lib/api';
import AutocompleteTicker, { TickerResult } from './AutocompleteTicker';

const TIPOS = [
  { v: 'Ações',           emoji: '📈', desc: 'Brasileiras e internacionais', autoTicker: true },
  { v: 'FIIs',            emoji: '🏢', desc: 'Fundos imobiliários',          autoTicker: true },
  { v: 'ETFs',            emoji: '🌐', desc: 'Fundos de índice',             autoTicker: true },
  { v: 'Cripto',          emoji: '₿',  desc: 'Bitcoin, Ethereum, etc.',      autoCripto: true },
  { v: 'Tesouro Direto',  emoji: '💵', desc: 'Selic, IPCA+, Prefixado' },
  { v: 'CDB',             emoji: '🏦', desc: 'CDB, CDI, LCI, LCA' },
  { v: 'Previdência',     emoji: '🏖️', desc: 'PGBL, VGBL' },
  { v: 'Reserva',         emoji: '🛡️', desc: 'Liquidez diária', isReserva: true },
  { v: 'Imóveis',         emoji: '🏠', desc: 'Físicos próprios' },
  { v: 'Negócio',         emoji: '🏪', desc: 'Empresas próprias' },
  { v: 'Caixa',           emoji: '💰', desc: 'Saldo em conta' },
];

const TESOURO_TIPOS = ['Selic', 'IPCA+', 'Prefixado', 'IPCA+ com juros semestrais'];
const INDEXADORES = ['CDI', 'IPCA', 'Pré-fixado', 'Selic'];

interface Props {
  phone: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function NovoInvestimentoModal({ phone, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [tipoSel, setTipoSel] = useState<typeof TIPOS[number] | null>(null);

  // Campos comuns
  const [nome,            setNome]            = useState('');
  const [ticker,          setTicker]          = useState('');
  const [quantidade,      setQuantidade]      = useState('');
  const [precoUnitario,   setPrecoUnitario]   = useState('');
  const [valorAportado,   setValorAportado]   = useState('');
  const [dataCompra,      setDataCompra]      = useState(new Date().toISOString().slice(0, 10));
  const [isReserva,       setIsReserva]       = useState(false);

  // Campos específicos
  const [taxaAnual,       setTaxaAnual]       = useState('');
  const [dataVencimento,  setDataVencimento]  = useState('');
  const [indexador,       setIndexador]       = useState<string>('');
  const [pctIndexador,    setPctIndexador]    = useState('');
  const [tesouroTipo,     setTesouroTipo]     = useState('Selic');
  const [tesouroAno,      setTesouroAno]      = useState(String(new Date().getFullYear() + 5));

  const [loading, setLoading] = useState(false);
  const [erro, setErro]       = useState('');

  function escolherTipo(t: typeof TIPOS[number]) {
    setTipoSel(t);
    setIsReserva(!!t.isReserva);
    if (t.v === 'Tesouro Direto') setNome(`Tesouro ${tesouroTipo} ${tesouroAno}`);
    setStep(2);
  }

  function onTickerPick(r: TickerResult) {
    setTicker(r.cripto ? (r.id || r.ticker.toLowerCase()) : r.ticker);
    if (!nome) setNome(r.nome);
  }

  function calcValorAportado() {
    const q = parseFloat(quantidade) || 0;
    const p = parseFloat(precoUnitario) || 0;
    if (q > 0 && p > 0) setValorAportado((q * p).toFixed(2));
  }

  async function handleSalvar() {
    setErro('');
    if (!tipoSel) return;
    if (!nome.trim()) { setErro('Informe o nome.'); return; }
    if (!valorAportado || parseFloat(valorAportado) <= 0) { setErro('Informe o valor investido.'); return; }

    setLoading(true);
    try {
      const payload: any = {
        phone,
        tipo:           tipoSel.v,
        nome:           nome.trim(),
        ticker:         ticker || null,
        valor_aportado: parseFloat(valorAportado),
        quantidade:     parseFloat(quantidade) || 1,
        preco_unitario: parseFloat(precoUnitario) || parseFloat(valorAportado),
        data_compra:    dataCompra,
        is_reserva_emergencia: isReserva,
        taxa_anual:     taxaAnual ? parseFloat(taxaAnual) : null,
        data_vencimento: dataVencimento || null,
        indexador:      indexador || null,
        percentual_indexador: pctIndexador ? parseFloat(pctIndexador) : null,
      };
      await api.investimentos.criar(payload);
      onSuccess();
      onClose();
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar investimento.');
    } finally {
      setLoading(false);
    }
  }

  const isMercado = tipoSel?.autoTicker || tipoSel?.autoCripto;
  const isTesouro = tipoSel?.v === 'Tesouro Direto';
  const isCDB     = tipoSel?.v === 'CDB' || tipoSel?.isReserva;
  const isPrev    = tipoSel?.v === 'Previdência';
  const isImovel  = tipoSel?.v === 'Imóveis';

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-xl bg-card rounded-3xl shadow-2xl overflow-hidden animate-fade-in border border-border max-h-[90vh] flex flex-col"
           onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            {step === 2 && (
              <button onClick={() => setStep(1)} className="p-1.5 rounded-xl hover:bg-muted transition-colors flex-shrink-0">
                <ChevronLeft size={18} className="text-muted-foreground" />
              </button>
            )}
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground leading-tight">
                {step === 1 ? 'Novo investimento' : `${tipoSel?.emoji} ${tipoSel?.v}`}
              </h2>
              <p className="text-xs text-muted-foreground">
                {step === 1 ? 'Escolha o tipo de ativo' : 'Preencha os detalhes'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors flex-shrink-0">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {step === 1 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TIPOS.map(t => (
                <button
                  key={t.v}
                  onClick={() => escolherTipo(t)}
                  className="flex flex-col items-center text-center gap-2 p-4 rounded-2xl border border-border bg-muted/30 hover:border-primary/40 hover:bg-card transition-all"
                >
                  <span className="text-3xl">{t.emoji}</span>
                  <span className="text-sm font-semibold text-foreground">{t.v}</span>
                  <span className="text-[11px] text-muted-foreground leading-tight">{t.desc}</span>
                </button>
              ))}
            </div>
          )}

          {step === 2 && tipoSel && (
            <div className="space-y-4">

              {/* Mercado: autocomplete */}
              {isMercado && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                    Buscar ativo
                  </label>
                  <AutocompleteTicker
                    modo={tipoSel.autoCripto ? 'cripto' : 'acao'}
                    onSelect={onTickerPick}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Cotação será atualizada automaticamente via{' '}
                    {tipoSel.autoCripto ? 'CoinGecko' : 'Yahoo Finance'}.
                  </p>
                </div>
              )}

              {/* Tesouro: pickers */}
              {isTesouro && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Modalidade</label>
                    <select value={tesouroTipo} onChange={e => { setTesouroTipo(e.target.value); setNome(`Tesouro ${e.target.value} ${tesouroAno}`); }} className="input">
                      {TESOURO_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Vencimento (ano)</label>
                    <input type="number" value={tesouroAno} onChange={e => { setTesouroAno(e.target.value); setNome(`Tesouro ${tesouroTipo} ${e.target.value}`); }} className="input" />
                  </div>
                </div>
              )}

              {/* Nome (sempre) */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                  Nome / descrição *
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder={isImovel ? 'Ex: Apto Vila Olímpia' : 'Nome do ativo'}
                  className="input"
                />
              </div>

              {/* Quantidade + Preço (mercado) */}
              {isMercado && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Quantidade</label>
                    <input type="number" step="any" value={quantidade} onChange={e => setQuantidade(e.target.value)} onBlur={calcValorAportado} className="input tabular" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Preço médio (R$)</label>
                    <input type="number" step="any" value={precoUnitario} onChange={e => setPrecoUnitario(e.target.value)} onBlur={calcValorAportado} className="input tabular" />
                  </div>
                </div>
              )}

              {/* CDB / Reserva */}
              {isCDB && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Indexador</label>
                    <select value={indexador} onChange={e => setIndexador(e.target.value)} className="input">
                      <option value="">—</option>
                      {INDEXADORES.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">% do indexador</label>
                    <input type="number" step="any" value={pctIndexador} onChange={e => setPctIndexador(e.target.value)} placeholder="100" className="input tabular" />
                  </div>
                </div>
              )}

              {/* Tesouro / CDB / Previdência: taxa */}
              {(isTesouro || isCDB || isPrev) && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Taxa anual (%)</label>
                    <input type="number" step="any" value={taxaAnual} onChange={e => setTaxaAnual(e.target.value)} className="input tabular" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Vencimento</label>
                    <input type="date" value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} className="input" />
                  </div>
                </div>
              )}

              {/* Valor + Data (sempre) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Valor aportado (R$) *</label>
                  <input type="number" step="any" value={valorAportado} onChange={e => setValorAportado(e.target.value)} className="input tabular text-right font-bold" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Data</label>
                  <input type="date" value={dataCompra} onChange={e => setDataCompra(e.target.value)} className="input" />
                </div>
              </div>

              {/* Toggle reserva emergencia */}
              {(isCDB || tipoSel.v === 'Caixa') && (
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/15 cursor-pointer">
                  <input type="checkbox" checked={isReserva} onChange={e => setIsReserva(e.target.checked)} className="w-4 h-4 accent-primary" />
                  <Shield size={14} className="text-primary flex-shrink-0" />
                  <span className="text-xs font-semibold text-foreground">Marcar como reserva de emergência</span>
                </label>
              )}

              {erro && (
                <div className="rounded-xl p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5">
                  <AlertCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">{erro}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 2 && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
            <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
            <button
              onClick={handleSalvar}
              disabled={loading}
              className="btn btn-primary px-4 py-2 text-sm gap-2 shadow-glow-sm"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Adicionar investimento
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
