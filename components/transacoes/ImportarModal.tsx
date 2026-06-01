'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Loader2, Upload, FileText, AlertCircle, Check, ArrowUpRight, ArrowDownRight, Pencil, Trash2, ArrowLeft, Copy } from 'lucide-react';
import { api } from '@/lib/api';
import { categorizarDescricao } from '@/lib/categorizar';
import { bancoLogo } from '@/components/cartoes/AdicionarCartaoModal';

// ─────────────────────────────────────────────────────────────
// PARSERS
// ─────────────────────────────────────────────────────────────

interface TxParsed {
  data:        string;          // YYYY-MM-DD
  observacao:  string;
  valor:       number;          // positivo
  tipo:        'Gasto' | 'Recebimento';
  fitid?:      string;          // id único do OFX (dedup)
}

function parseOFXDate(s: string): string | null {
  if (!s) return null;
  // OFX: YYYYMMDDHHmmss[timezone] ou só YYYYMMDD
  const m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function parseOFX(text: string): TxParsed[] {
  // Regex robusta: pega cada bloco <STMTTRN>...</STMTTRN>
  const txns: TxParsed[] = [];
  const blocoRe = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;
  while ((match = blocoRe.exec(text)) !== null) {
    const block = match[1];
    const get = (tag: string) => {
      const r = block.match(new RegExp(`<${tag}>\\s*([^<\\r\\n]*)`, 'i'));
      return r ? r[1].trim() : '';
    };
    const data = parseOFXDate(get('DTPOSTED'));
    const amt = parseFloat(get('TRNAMT') || '0');
    const memo = get('MEMO') || get('NAME') || 'Transação importada';
    const fitid = get('FITID');
    if (!data || isNaN(amt) || amt === 0) continue;
    txns.push({
      data,
      observacao: memo.replace(/&amp;/g, '&').slice(0, 200),
      valor: Math.abs(amt),
      tipo: amt >= 0 ? 'Recebimento' : 'Gasto',
      fitid: fitid || undefined,
    });
  }
  return txns;
}

function parseFlexDate(s: string): string | null {
  if (!s) return null;
  const t = s.trim();
  // DD/MM/YYYY ou DD-MM-YYYY
  let m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  // YYYY-MM-DD ou YYYY/MM/DD
  m = t.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  return null;
}

function parseCSVLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === sep && !inQuote) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

export function parseCSV(text: string): TxParsed[] {
  const lines = text.replace(/^﻿/, '').trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // Detecta separador olhando o cabeçalho
  const first = lines[0];
  const sep = (first.match(/;/g)?.length || 0) > (first.match(/,/g)?.length || 0) ? ';' : ',';

  const headers = parseCSVLine(first, sep).map(h => h.toLowerCase());
  const findCol = (re: RegExp) => headers.findIndex(h => re.test(h));

  const colData  = findCol(/\b(data|date|dt)\b/);
  const colDesc  = findCol(/(descri|histor|memo|name|titulo|estabel)/);
  const colValor = findCol(/(valor|amount|amt|montante|debit|credit|saida|entrada)/);

  if (colData < 0 || colValor < 0) {
    // Tenta heurística baseada em posição: 1ª coluna = data, última numérica = valor
    return parseCSVFallback(lines, sep);
  }

  const txns: TxParsed[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i], sep);
    if (cols.length < Math.max(colData, colValor) + 1) continue;

    const data = parseFlexDate(cols[colData]);
    if (!data) continue;

    const valorRaw = cols[colValor];
    const valor = parseFloat(
      valorRaw.replace(/R\$|\s/g, '').replace(/\./g, '').replace(',', '.')
    );
    if (isNaN(valor) || valor === 0) continue;

    const desc = colDesc >= 0 ? cols[colDesc] : 'Transação importada';
    txns.push({
      data,
      observacao: (desc || 'Transação').slice(0, 200),
      valor: Math.abs(valor),
      tipo: valor < 0 ? 'Gasto' : 'Recebimento',
    });
  }
  return txns;
}

function parseCSVFallback(lines: string[], sep: string): TxParsed[] {
  // Fallback: assume col 0 = data, col -1 = valor
  const txns: TxParsed[] = [];
  for (const line of lines) {
    const cols = parseCSVLine(line, sep);
    if (cols.length < 2) continue;
    const data = parseFlexDate(cols[0]);
    if (!data) continue;
    const last = cols[cols.length - 1].replace(/R\$|\s/g, '').replace(/\./g, '').replace(',', '.');
    const valor = parseFloat(last);
    if (isNaN(valor) || valor === 0) continue;
    const desc = cols.slice(1, -1).join(' - ').slice(0, 200) || 'Transação importada';
    txns.push({
      data,
      observacao: desc,
      valor: Math.abs(valor),
      tipo: valor < 0 ? 'Gasto' : 'Recebimento',
    });
  }
  return txns;
}

// ─────────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtData = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');

interface Props {
  phone:   string;
  wallets: any[];
  formato: 'ofx' | 'csv';
  onClose:   () => void;
  onSuccess: (qtd: number) => void;
}

type Row = {
  data:       string;
  observacao: string;
  valor:      number;
  tipo:       'Gasto' | 'Recebimento';
  fitid?:     string;
  categoria:  string;
  selecionada: boolean;
  dup:        boolean;   // possível duplicata (já existe transação igual)
  editando:   boolean;
};

const CAT_IMPORTADO = '📦 Importado';

export default function ImportarModal({ phone, wallets, formato, onClose, onSuccess }: Props) {
  const walletsImportaveis = wallets; // bancárias e cartões — você escolhe a conta certa

  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [walletId, setWalletId] = useState<string>(
    wallets.find(w => w.tipo !== 'Crédito')?.id || wallets[0]?.id || '',
  );
  const [rows, setRows] = useState<Row[]>([]);
  const [arquivoNome, setArquivoNome] = useState('');
  const [erroParse, setErroParse] = useState('');
  const [analisando, setAnalisando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [erro, setErro] = useState('');
  const [categorias, setCategorias] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const aceitarExt = formato === 'ofx' ? '.ofx,.OFX' : '.csv,.CSV,.txt';
  const walletNome = wallets.find(w => w.id === walletId)?.nome || 'Dinheiro';

  // Carrega categorias pra o seletor da revisão
  useEffect(() => {
    if (!phone) return;
    api.categorias.listar(phone)
      .then((cs: any[]) => setCategorias([CAT_IMPORTADO, ...(cs || []).map(c => c.nome).filter(Boolean)]))
      .catch(() => setCategorias([CAT_IMPORTADO]));
  }, [phone]);

  async function handleFile(file: File) {
    setArquivoNome(file.name);
    setErroParse('');
    if (file.size > 5 * 1024 * 1024) { setErroParse('Arquivo muito grande (máx. 5 MB).'); return; }
    if (!walletId) { setErroParse('Selecione a conta destino antes de escolher o arquivo.'); return; }

    setAnalisando(true);
    try {
      const text = await file.text();
      const txs = formato === 'ofx' ? parseOFX(text) : parseCSV(text);
      if (txs.length === 0) {
        setErroParse(`Nenhuma transação detectada. Verifique se o arquivo é um ${formato.toUpperCase()} válido.`);
        setAnalisando(false);
        return;
      }
      txs.sort((a, b) => b.data.localeCompare(a.data));

      // Detecção de duplicatas: compara com as transações já existentes na
      // conta (mesma data + valor + tipo). O FITID também é deduplicado no
      // servidor — esta heurística cobre recorrências/lançamentos manuais.
      let existentes: any[] = [];
      try {
        const r = await api.transacoes.listar(phone, { limit: 800 });
        existentes = (r.transacoes || []).filter(
          (t: any) => (t.carteira_nome || t.wallet_nome) === walletNome,
        );
      } catch { /* sem rede — segue sem dedup heurística */ }
      const chave = (d: string, v: number, tp: string) => `${d}|${v.toFixed(2)}|${tp}`;
      const existSet = new Set(existentes.map((t: any) => chave(String(t.data).slice(0, 10), Math.abs(t.valor || 0), t.tipo)));

      const novas: Row[] = txs.map(t => {
        const dup = existSet.has(chave(t.data, t.valor, t.tipo));
        // Auto-categoriza pela descrição ("AMAZONMD" → Amazon, "IFOOD*" → iFood…).
        // Só sugere pra despesas; receitas ficam como Importado pra revisão.
        const sugerida = t.tipo === 'Gasto' ? categorizarDescricao(t.observacao) : null;
        return { ...t, categoria: sugerida || CAT_IMPORTADO, selecionada: !dup, dup, editando: false };
      });
      setRows(novas);
      setStep('review');
    } catch (e: any) {
      setErroParse('Erro ao ler o arquivo: ' + (e.message || 'desconhecido'));
    } finally {
      setAnalisando(false);
    }
  }

  function patchRow(i: number, patch: Partial<Row>) {
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removerRow(i: number) {
    setRows(rs => rs.filter((_, idx) => idx !== i));
  }

  async function importar() {
    setErro('');
    const escolhidas = rows.filter(r => r.selecionada);
    if (escolhidas.length === 0) { setErro('Selecione pelo menos uma transação.'); return; }
    if (!walletId) { setErro('Escolha a conta destino.'); return; }

    setImportando(true);
    try {
      const r = await api.transacoes.criarBulk({
        phone,
        transacoes: escolhidas.map(t => ({
          data: t.data, tipo: t.tipo, valor: t.valor,
          observacao: t.observacao, carteira_nome: walletNome,
          categoria: t.categoria || CAT_IMPORTADO, pago: true,
          fitid: t.fitid,
        })),
      });
      onSuccess(r.inserted);
      onClose();
    } catch (e: any) {
      setErro(e.message || 'Erro ao importar.');
    } finally {
      setImportando(false);
    }
  }

  const selecionadas = rows.filter(r => r.selecionada);
  const dupCount = rows.filter(r => r.dup).length;
  const resumo = useMemo(() => ({
    qtd: selecionadas.length,
    receitas: selecionadas.filter(t => t.tipo === 'Recebimento').reduce((s, t) => s + t.valor, 0),
    gastos:   selecionadas.filter(t => t.tipo === 'Gasto').reduce((s, t) => s + t.valor, 0),
  }), [rows]);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative w-full max-w-2xl bg-card rounded-3xl shadow-2xl overflow-hidden animate-fade-in border border-border max-h-[92dvh] flex flex-col"
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            {step === 'review' && (
              <button onClick={() => setStep('upload')} className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors" aria-label="Voltar">
                <ArrowLeft size={18} className="text-muted-foreground" />
              </button>
            )}
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/15">
              <Upload size={20} className="text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground leading-tight">
                {step === 'upload' ? `Importar ${formato.toUpperCase()}` : 'Revisar transações'}
              </h2>
              <p className="text-xs text-muted-foreground truncate">
                {step === 'upload' ? 'Passo 1 de 2 · Conta + arquivo' : 'Passo 2 de 2 · Edite ou remova antes de confirmar'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors flex-shrink-0">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        {/* ── PASSO 1: conta + arquivo ──────────────────────────── */}
        {step === 'upload' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                1. Para qual conta vão as transações?
              </label>
              {walletsImportaveis.length === 0 ? (
                <div className="rounded-xl p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-700 dark:text-amber-300">
                  Você não tem contas cadastradas. <a href="/contas-bancarias" className="underline font-semibold">Criar agora</a>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto">
                  {walletsImportaveis.map(w => {
                    const logo = bancoLogo(w.nome);
                    const ativa = w.id === walletId;
                    return (
                      <button key={w.id} onClick={() => setWalletId(w.id)}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${ativa ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border bg-muted/20 hover:border-primary/40'}`}>
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0" style={{ background: logo.bg }}>{logo.text}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{w.nome}</p>
                          <p className="text-[10px] text-muted-foreground">{w.tipo}</p>
                        </div>
                        {ativa && <Check size={15} className="text-primary flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                2. Escolha o arquivo {formato.toUpperCase()}
              </label>
              <button onClick={() => walletId ? fileRef.current?.click() : setErroParse('Selecione a conta primeiro.')}
                disabled={analisando || !walletId}
                className="w-full rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-all p-8 flex flex-col items-center justify-center gap-3 group disabled:opacity-50">
                {analisando ? <Loader2 size={24} className="animate-spin text-primary" /> : (
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileText size={24} className="text-primary" />
                  </div>
                )}
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">{analisando ? 'Analisando…' : 'Clique para escolher o arquivo'}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formato === 'ofx' ? 'Aceita .ofx' : 'Aceita .csv ou .txt'} (até 5 MB)</p>
                </div>
              </button>
              <input ref={fileRef} type="file" accept={aceitarExt} hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
            </div>

            <div className="rounded-xl p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 mb-1.5">Onde baixo esse arquivo?</p>
              <p className="text-[11px] text-blue-700/90 dark:text-blue-300/90 leading-relaxed">
                No app do seu banco: extrato → <strong>"Exportar/Compartilhar"</strong> → <strong>{formato === 'ofx' ? 'OFX' : 'CSV/Excel'}</strong>. Transações que você já tem na conta são detectadas e marcadas como duplicadas no próximo passo.
              </p>
            </div>

            {erroParse && (
              <div className="rounded-xl p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5">
                <AlertCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">{erroParse}</p>
              </div>
            )}
          </div>
        )}

        {/* ── PASSO 2: revisão + edição ─────────────────────────── */}
        {step === 'review' && (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">{selecionadas.length}</strong> de {rows.length} selecionada{selecionadas.length !== 1 ? 's' : ''} · conta <strong className="text-foreground">{walletNome}</strong>
                </p>
                <div className="flex gap-1.5">
                  <button onClick={() => setRows(rs => rs.map(r => ({ ...r, selecionada: true })))} className="btn-ghost px-2.5 py-1 text-[11px]">Todas</button>
                  <button onClick={() => setRows(rs => rs.map(r => ({ ...r, selecionada: false })))} className="btn-ghost px-2.5 py-1 text-[11px]">Nenhuma</button>
                </div>
              </div>

              {dupCount > 0 && (
                <div className="rounded-xl p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex items-start gap-2.5">
                  <Copy size={15} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                    <strong>{dupCount}</strong> transaç{dupCount === 1 ? 'ão parece' : 'ões parecem'} já estar na conta (mesma data e valor) — desmarcamos pra você não duplicar. Confira e marque se quiser importar mesmo assim.
                  </p>
                </div>
              )}

              <ul className="space-y-2">
                {rows.map((r, i) => {
                  const ehGasto = r.tipo === 'Gasto';
                  return (
                    <li key={i} className={`rounded-2xl border transition-colors ${r.dup ? 'border-amber-300/60 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/10' : 'border-border bg-card'} ${!r.selecionada ? 'opacity-55' : ''}`}>
                      <div className="flex items-center gap-2.5 p-2.5">
                        <input type="checkbox" checked={r.selecionada} onChange={() => patchRow(i, { selecionada: !r.selecionada })} className="w-4 h-4 accent-primary cursor-pointer flex-shrink-0" />
                        <span className="text-xs text-muted-foreground tabular w-12 flex-shrink-0">{fmtData(r.data)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate">{r.observacao}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{r.categoria}{r.dup && <span className="text-amber-600 dark:text-amber-400 font-semibold"> · possível duplicata</span>}</p>
                        </div>
                        <span className={`tabular font-bold text-xs inline-flex items-center gap-0.5 flex-shrink-0 ${ehGasto ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                          {ehGasto ? <ArrowDownRight size={11} /> : <ArrowUpRight size={11} />}{fmt(r.valor)}
                        </span>
                        <button onClick={() => patchRow(i, { editando: !r.editando })} className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors flex-shrink-0" aria-label="Editar"><Pencil size={14} /></button>
                        <button onClick={() => removerRow(i)} className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors flex-shrink-0" aria-label="Remover"><Trash2 size={14} /></button>
                      </div>

                      {r.editando && (
                        <div className="px-2.5 pb-2.5 pt-1 grid grid-cols-1 sm:grid-cols-[1fr_140px_110px] gap-2 animate-fade-in border-t border-border/50 mt-1">
                          <input value={r.observacao} onChange={e => patchRow(i, { observacao: e.target.value })} placeholder="Descrição"
                            className="px-3 h-10 rounded-xl bg-background border border-border text-sm focus:outline-none focus:border-primary" />
                          <select value={r.categoria} onChange={e => patchRow(i, { categoria: e.target.value })}
                            className="px-2 h-10 rounded-xl bg-background border border-border text-sm focus:outline-none focus:border-primary">
                            {Array.from(new Set([...categorias, ...(r.categoria ? [r.categoria] : [])]))
                              .map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <div className="flex gap-2">
                            <input inputMode="decimal" value={String(r.valor).replace('.', ',')}
                              onChange={e => patchRow(i, { valor: Math.abs(parseFloat(e.target.value.replace(',', '.')) || 0) })}
                              className="w-full px-3 h-10 rounded-xl bg-background border border-border text-sm tabular focus:outline-none focus:border-primary" />
                            <button onClick={() => patchRow(i, { tipo: ehGasto ? 'Recebimento' : 'Gasto' })}
                              className={`px-2 h-10 rounded-xl text-xs font-bold flex-shrink-0 ${ehGasto ? 'bg-red-500/15 text-red-600 dark:text-red-400' : 'bg-green-500/15 text-green-600 dark:text-green-400'}`}>
                              {ehGasto ? 'Gasto' : 'Receita'}
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>

              {erro && (
                <div className="rounded-xl p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5">
                  <AlertCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">{erro}</p>
                </div>
              )}
            </div>

            <div className="flex-shrink-0 px-5 sm:px-6 py-4 border-t border-border bg-muted/20 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <ResumoCard label="Selecionadas" value={String(resumo.qtd)} />
                <ResumoCard label="Receitas"     value={fmt(resumo.receitas)} cor="#22c55e" />
                <ResumoCard label="Gastos"       value={fmt(resumo.gastos)}   cor="#ef4444" />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setStep('upload')} className="btn-ghost px-4 py-2 text-sm">Voltar</button>
                <button onClick={importar} disabled={importando || resumo.qtd === 0}
                  className="btn btn-primary px-4 py-2 text-sm gap-2 shadow-glow-sm whitespace-nowrap">
                  {importando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Importar {resumo.qtd > 0 ? `(${resumo.qtd})` : ''}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ResumoCard({ label, value, cor }: { label: string; value: string; cor?: string }) {
  return (
    <div className="rounded-xl p-3 bg-muted/30 border border-border/60">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-base font-bold tabular tracking-tight mt-1" style={{ color: cor || 'hsl(var(--fg))' }}>
        {value}
      </p>
    </div>
  );
}
