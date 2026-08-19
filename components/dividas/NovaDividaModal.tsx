'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Loader2, AlertCircle, Check, Receipt, Building2, Home, ShoppingCart, CreditCard, AlertTriangle, Briefcase, GraduationCap, FileText, Camera, Upload, Trash2, Users, Ticket, Trophy } from 'lucide-react';
import { api } from '@/lib/api';

// Redimensiona a foto pra dataURL (~1000px) — igual às metas, sem bucket.
async function redimensionar(file: File, max = 1000, q = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        const escala = Math.min(max / img.width, max / img.height, 1);
        c.width = Math.round(img.width * escala);
        c.height = Math.round(img.height * escala);
        const ctx = c.getContext('2d');
        if (!ctx) return reject(new Error('Canvas indisponível'));
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', q));
      };
      img.onerror = () => reject(new Error('Imagem inválida'));
      img.src = r.result as string;
    };
    r.onerror = () => reject(new Error('Erro ao ler arquivo'));
    r.readAsDataURL(file);
  });
}

const TIPOS = [
  { v: 'emprestimo',       l: 'Empréstimo',         icon: Briefcase,    cor: '#3b82f6', desc: 'Pessoal, consignado livre, etc.' },
  { v: 'financiamento',    l: 'Financiamento',      icon: Home,         cor: '#8b5cf6', desc: 'Imóvel, veículo, equipamento' },
  { v: 'consorcio',        l: 'Consórcio',          icon: Ticket,       cor: '#0ea5e9', desc: 'Carta de crédito, com ou sem contemplação' },
  { v: 'crediario',        l: 'Crediário',          icon: ShoppingCart, cor: '#f59e0b', desc: 'Loja de departamento, eletro' },
  { v: 'parcelamento',     l: 'Parcelamento',       icon: Users,        cor: '#10b981', desc: 'Parcelei com alguém, sem cartão' },
  { v: 'cartao_rotativo',  l: 'Cartão rotativo',    icon: CreditCard,   cor: '#ef4444', desc: 'Saldo não pago da fatura' },
  { v: 'cheque_especial',  l: 'Cheque especial',    icon: AlertTriangle,cor: '#f97316', desc: 'Limite do banco usado' },
  { v: 'consignado',       l: 'Consignado',         icon: Building2,    cor: '#06b6d4', desc: 'Descontado em folha' },
  { v: 'fies',             l: 'FIES / Crédito edu.', icon: GraduationCap, cor: '#14b8a6', desc: 'Financiamento estudantil' },
  { v: 'outro',            l: 'Outro',              icon: FileText,     cor: '#64748b', desc: 'Outra modalidade' },
] as const;

const INDEXADORES = ['Pré-fixado', 'CDI', 'IPCA', 'Selic', 'Outro'];

interface Props {
  phone:   string;
  edicao?: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function NovaDividaModal({ phone, edicao, onClose, onSuccess }: Props) {
  const ediMode = !!edicao;

  const [titulo,          setTitulo]          = useState(edicao?.titulo || '');
  const [credor,          setCredor]          = useState(edicao?.credor || '');
  const [tipo,            setTipo]            = useState<string>(edicao?.tipo || 'emprestimo');
  const [valorTotalRaw,   setValorTotalRaw]   = useState(
    edicao?.valor_total ? String(Math.round(edicao.valor_total * 100)) : ''
  );
  const [valorParcelaRaw, setValorParcelaRaw] = useState(
    edicao?.valor_parcela ? String(Math.round(edicao.valor_parcela * 100)) : ''
  );
  const [parcelasTotal,   setParcelasTotal]   = useState<string>(edicao?.parcelas_total?.toString() || '');
  const [parcelasPagas,   setParcelasPagas]   = useState<string>(edicao?.parcelas_pagas?.toString() || '0');
  const [taxaJuros,       setTaxaJuros]       = useState<string>(edicao?.taxa_juros?.toString() || '');
  const [indexador,       setIndexador]       = useState<string>(edicao?.indexador || '');
  const [diaVencimento,   setDiaVencimento]   = useState<string>(edicao?.dia_vencimento?.toString() || '');
  const [dataInicio,      setDataInicio]      = useState(edicao?.data_inicio || new Date().toISOString().slice(0, 10));
  const [observacao,      setObservacao]      = useState(edicao?.observacao || '');
  const [imagem,          setImagem]          = useState<string | null>(edicao?.imagem_url || null);

  // ── Consórcio (migration 125) ────────────────────────────────────────────
  // O que separa consórcio de financiamento: existe uma CARTA (dinheiro a
  // receber) e uma CONTEMPLAÇÃO que divide a cota em antes e depois.
  const [ccCredito,     setCcCredito]     = useState<string>(edicao?.consorcio_credito?.toString() || '');
  const [ccLance,       setCcLance]       = useState<string>(edicao?.consorcio_lance?.toString() || '');
  const [ccGrupo,       setCcGrupo]       = useState<string>(edicao?.consorcio_grupo || '');
  const [ccCota,        setCcCota]        = useState<string>(edicao?.consorcio_cota || '');
  const [ccContemplado, setCcContemplado] = useState<boolean>(!!edicao?.consorcio_contemplado);
  const [ccContempEm,   setCcContempEm]   = useState<string>(edicao?.consorcio_contemplado_em || '');

  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro,    setErro]    = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFoto(file: File) {
    if (file.size > 8 * 1024 * 1024) { setErro('Imagem muito grande (máx. 8 MB).'); return; }
    setErro('');
    setUploading(true);
    try { setImagem(await redimensionar(file)); }
    catch (e: any) { setErro(e.message || 'Erro ao processar imagem.'); }
    finally { setUploading(false); }
  }

  // Auto-calcula valor da parcela quando muda total ou parcelas
  useEffect(() => {
    if (valorParcelaRaw) return; // user já editou manualmente
    if (!valorTotalRaw || !parcelasTotal) return;
    const total = parseInt(valorTotalRaw, 10) / 100;
    const n = parseInt(parcelasTotal, 10);
    if (n > 0 && total > 0) {
      setValorParcelaRaw(String(Math.round((total / n) * 100)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorTotalRaw, parcelasTotal]);

  const tipoSel = useMemo(() => TIPOS.find(t => t.v === tipo) || TIPOS[0], [tipo]);
  const ehConsorcio = tipo === 'consorcio';

  function fmtBR(raw: string) {
    if (!raw) return '0,00';
    return (parseInt(raw, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function salvar() {
    setErro('');
    if (!titulo.trim()) { setErro('Dê um nome pra dívida.'); return; }
    if (!valorTotalRaw || valorTotalRaw === '0') { setErro('Informe o valor total.'); return; }
    setLoading(true);
    try {
      const payload = {
        titulo: titulo.trim(),
        credor: credor.trim() || undefined,
        tipo,
        valor_total:    parseInt(valorTotalRaw, 10) / 100,
        valor_parcela:  valorParcelaRaw ? parseInt(valorParcelaRaw, 10) / 100 : undefined,
        parcelas_total: parcelasTotal ? parseInt(parcelasTotal, 10) : undefined,
        parcelas_pagas: parseInt(parcelasPagas || '0', 10),
        taxa_juros:     taxaJuros ? parseFloat(taxaJuros) : undefined,
        indexador:      indexador || undefined,
        dia_vencimento: diaVencimento ? parseInt(diaVencimento, 10) : undefined,
        data_inicio:    dataInicio || undefined,
        observacao:     observacao.trim() || undefined,
        imagem_url:     imagem || null,
        // Só manda os campos do consórcio quando o tipo é consórcio — assim
        // trocar de tipo não deixa carta órfã numa dívida que não é cota.
        ...(ehConsorcio ? {
          consorcio_credito:       ccCredito ? parseFloat(ccCredito) : null,
          consorcio_lance:         ccLance ? parseFloat(ccLance) : null,
          consorcio_grupo:         ccGrupo.trim() || null,
          consorcio_cota:          ccCota.trim() || null,
          consorcio_contemplado:   ccContemplado,
          consorcio_contemplado_em: ccContemplado ? (ccContempEm || null) : null,
        } : {}),
      };
      if (ediMode) {
        await api.dividas.editar(edicao.id, { ...payload, phone });
      } else {
        await api.dividas.criar({ phone, ...payload });
      }
      onSuccess();
      onClose();
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar dívida.');
    } finally {
      setLoading(false);
    }
  }

  // Preview do progresso atual
  const pagasNum = parseInt(parcelasPagas || '0', 10);
  const totalNum = parseInt(parcelasTotal || '0', 10);
  const pct = totalNum > 0 ? Math.min((pagasNum / totalNum) * 100, 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-lg bg-card rounded-3xl shadow-2xl overflow-hidden animate-fade-in border border-border max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `color-mix(in srgb, ${tipoSel.cor} 13%, transparent)`, color: tipoSel.cor }}
            >
              <tipoSel.icon size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground leading-tight">
                {ediMode ? 'Editar dívida' : 'Nova dívida'}
              </h2>
              <p className="text-xs text-muted-foreground">
                Registre empréstimos, financiamentos e parcelas
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">

          {/* Foto do que está sendo pago (opcional) — ajuda a visualizar */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Foto <span className="text-muted-foreground/60 normal-case font-normal">(opcional — ex.: o aparelho, o carro…)</span>
            </label>
            <div className="relative rounded-2xl overflow-hidden border border-border group" style={{ aspectRatio: '16/7' }}>
              {imagem ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagem} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  <div className="absolute top-2 right-2 flex gap-1">
                    <button type="button" onClick={() => fileRef.current?.click()} title="Trocar"
                            className="p-1.5 rounded-lg bg-card/80 backdrop-blur-sm hover:bg-card transition-colors">
                      <Camera size={13} className="text-foreground" />
                    </button>
                    <button type="button" onClick={() => setImagem(null)} title="Remover"
                            className="p-1.5 rounded-lg bg-card/80 backdrop-blur-sm hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors">
                      <Trash2 size={13} className="text-red-500" />
                    </button>
                  </div>
                </>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                        className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/30 hover:bg-muted/50 transition-colors text-muted-foreground">
                  {uploading ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
                  <span className="text-xs font-semibold">{uploading ? 'Enviando…' : 'Adicionar foto (opcional)'}</span>
                  <span className="text-[10px]">JPG / PNG até 8 MB</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" hidden
                     onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFoto(f); e.target.value = ''; }} />
            </div>
          </div>

          {/* Tipo de dívida */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Tipo *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TIPOS.map(t => {
                const ativo = tipo === t.v;
                const Icon = t.icon;
                return (
                  <button
                    key={t.v}
                    onClick={() => setTipo(t.v)}
                    type="button"
                    title={t.desc}
                    className={`flex flex-col items-center text-center gap-1.5 p-2.5 rounded-xl border transition-all ${
                      ativo
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'border-border bg-muted/30 hover:border-primary/40'
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: `color-mix(in srgb, ${t.cor} 13%, transparent)`, color: t.cor }}
                    >
                      <Icon size={16} />
                    </div>
                    <span className="text-[10px] font-semibold text-foreground leading-tight">{t.l}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Título + credor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Nome da dívida *
              </label>
              <input
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                placeholder='Ex: "Carro Honda Civic"'
                maxLength={50}
                autoFocus={!ediMode}
                className="input"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Credor
              </label>
              <input
                value={credor}
                onChange={e => setCredor(e.target.value)}
                placeholder='Ex: "Banco Itaú"'
                maxLength={50}
                className="input"
              />
            </div>
          </div>

          {/* Valor total + parcelas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Valor total *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">R$</span>
                <input
                  inputMode="numeric"
                  value={fmtBR(valorTotalRaw)}
                  onChange={e => setValorTotalRaw(e.target.value.replace(/\D/g, ''))}
                  className="input pl-9 tabular text-right font-bold"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Total de parcelas
              </label>
              <input
                type="number"
                min={1}
                max={480}
                value={parcelasTotal}
                onChange={e => setParcelasTotal(e.target.value)}
                placeholder="Ex: 36"
                className="input tabular text-right"
              />
            </div>
          </div>

          {/* Valor da parcela + já pagas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Valor da parcela
                <span className="ml-1 text-[9px] font-normal normal-case text-muted-foreground/60">(auto)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">R$</span>
                <input
                  inputMode="numeric"
                  value={fmtBR(valorParcelaRaw)}
                  onChange={e => setValorParcelaRaw(e.target.value.replace(/\D/g, ''))}
                  className="input pl-9 tabular text-right"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Já pagas
              </label>
              <input
                type="number"
                min={0}
                max={parseInt(parcelasTotal || '999', 10)}
                value={parcelasPagas}
                onChange={e => setParcelasPagas(e.target.value)}
                placeholder="0"
                className="input tabular text-right"
              />
            </div>
          </div>

          {/* Preview progresso */}
          {totalNum > 0 && (
            <div className="rounded-xl p-3 bg-muted/30 border border-border/60">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-bold tabular" style={{ color: tipoSel.cor }}>
                  {pagasNum}/{totalNum} ({pct.toFixed(0)}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                     style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${tipoSel.cor}, color-mix(in srgb, ${tipoSel.cor} 67%, transparent))` }} />
              </div>
            </div>
          )}

          {/* ── CONSÓRCIO ────────────────────────────────────────────────
              Só aparece no tipo consórcio. São os campos que financiamento
              não tem: a CARTA (dinheiro a receber) e a CONTEMPLAÇÃO. */}
          {ehConsorcio && (
            <div className="rounded-2xl p-4 space-y-3"
                 style={{ border: '1px solid color-mix(in srgb, #0ea5e9 32%, transparent) !important',
                          background: 'color-mix(in srgb, #0ea5e9 6%, transparent)' }}>
              <div className="flex items-center gap-2">
                <Ticket size={15} style={{ color: '#0ea5e9' }} />
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#0ea5e9' }}>
                  Dados da carta
                </p>
              </div>

              <div>
                <label htmlFor="cc-credito" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                  Valor da carta de crédito
                </label>
                <input id="cc-credito" type="number" step="any" inputMode="decimal"
                  value={ccCredito} onChange={e => setCcCredito(e.target.value)}
                  placeholder="Quanto você vai receber" className="input tabular text-right" />
                <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">
                  É o crédito que você recebe ao ser contemplado — diferente do total que você paga.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cc-grupo" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                    Grupo
                  </label>
                  <input id="cc-grupo" value={ccGrupo} onChange={e => setCcGrupo(e.target.value)}
                    placeholder="Ex: 1234" className="input" />
                </div>
                <div>
                  <label htmlFor="cc-cota" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                    Cota
                  </label>
                  <input id="cc-cota" value={ccCota} onChange={e => setCcCota(e.target.value)}
                    placeholder="Ex: 56" className="input" />
                </div>
              </div>

              {/* Contemplação — o divisor de águas da cota. Botão inteiro
                  clicável (não checkbox solto): alvo de toque de 44pt. */}
              <button type="button" onClick={() => setCcContemplado(v => !v)}
                aria-pressed={ccContemplado}
                className="w-full flex items-center gap-3 rounded-xl px-3 text-left transition-colors"
                style={{ minHeight: 52,
                         border: `1px solid ${ccContemplado ? '#16a34a' : 'hsl(var(--border))'} !important`,
                         background: ccContemplado ? 'color-mix(in srgb, #16a34a 10%, transparent)' : 'transparent' }}>
                <Trophy size={17} style={{ color: ccContemplado ? '#16a34a' : 'hsl(var(--muted-foreground))' }} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-foreground">
                    {ccContemplado ? 'Contemplada' : 'Ainda não contemplada'}
                  </span>
                  <span className="block text-[11px] text-muted-foreground leading-snug">
                    {ccContemplado ? 'Você já recebeu o crédito' : 'Toque se já foi contemplado'}
                  </span>
                </span>
                {ccContemplado && <Check size={16} style={{ color: '#16a34a' }} />}
              </button>

              {ccContemplado && (
                <div className="grid grid-cols-2 gap-3 animate-fade-in">
                  <div>
                    <label htmlFor="cc-quando" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                      Contemplada em
                    </label>
                    <input id="cc-quando" type="date" value={ccContempEm}
                      onChange={e => setCcContempEm(e.target.value)} className="input" />
                  </div>
                  <div>
                    <label htmlFor="cc-lance" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                      Lance dado
                    </label>
                    <input id="cc-lance" type="number" step="any" inputMode="decimal"
                      value={ccLance} onChange={e => setCcLance(e.target.value)}
                      placeholder="0,00" className="input tabular text-right" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Juros + indexador + dia vencimento + data início */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                {/* No consórcio não há juros: o custo é a taxa de administração. */}
                {ehConsorcio ? 'Taxa de administração (%)' : 'Taxa de juros (% a.m.)'}
              </label>
              <input
                type="number"
                step="any"
                value={taxaJuros}
                onChange={e => setTaxaJuros(e.target.value)}
                placeholder="Ex: 1.99"
                className="input tabular text-right"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Indexador
              </label>
              <select value={indexador} onChange={e => setIndexador(e.target.value)} className="input">
                <option value="">—</option>
                {INDEXADORES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Dia de vencimento
              </label>
              <select
                value={diaVencimento}
                onChange={e => setDiaVencimento(e.target.value)}
                className="input"
              >
                <option value="">—</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>Dia {d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Data início
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Observação <span className="text-muted-foreground/60 normal-case font-normal">(opcional)</span>
            </label>
            <input
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              placeholder="Notas, condições especiais, etc."
              maxLength={200}
              className="input"
            />
          </div>

          {erro && (
            <div className="rounded-xl p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5">
              <AlertCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">{erro}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
          <button
            onClick={salvar}
            disabled={loading}
            className="btn btn-primary px-4 py-2 text-sm gap-2 shadow-glow-sm"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {ediMode ? 'Salvar alterações' : 'Criar dívida'}
          </button>
        </div>
      </div>
    </div>
  );
}
