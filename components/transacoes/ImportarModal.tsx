'use client';

import { useMemo, useRef, useState } from 'react';
import { X, Loader2, Upload, FileText, AlertCircle, Check, ArrowUpRight, ArrowDownRight, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { bancoLogo } from '@/components/cartoes/AdicionarCartaoModal';

// ─────────────────────────────────────────────────────────────
// PARSERS
// ─────────────────────────────────────────────────────────────

interface TxParsed {
  data:        string;          // YYYY-MM-DD
  observacao:  string;
  valor:       number;          // positivo
  tipo:        'Gasto' | 'Recebimento';
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
    if (!data || isNaN(amt) || amt === 0) continue;
    txns.push({
      data,
      observacao: memo.replace(/&amp;/g, '&').slice(0, 200),
      valor: Math.abs(amt),
      tipo: amt >= 0 ? 'Recebimento' : 'Gasto',
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

export default function ImportarModal({ phone, wallets, formato, onClose, onSuccess }: Props) {
  const [transacoes, setTransacoes] = useState<TxParsed[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());
  const [walletId, setWalletId] = useState<string>(wallets.find(w => w.tipo !== 'Crédito')?.id || wallets[0]?.id || '');
  const [arquivoNome, setArquivoNome] = useState('');
  const [erroParse, setErroParse] = useState('');
  const [importando, setImportando] = useState(false);
  const [erro, setErro] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const aceitarExt = formato === 'ofx' ? '.ofx,.OFX' : '.csv,.CSV,.txt';

  async function handleFile(file: File) {
    setArquivoNome(file.name);
    setErroParse('');
    setTransacoes([]);
    setSelecionadas(new Set());

    if (file.size > 5 * 1024 * 1024) {
      setErroParse('Arquivo muito grande (máx. 5 MB).');
      return;
    }

    try {
      const text = await file.text();
      const txs = formato === 'ofx' ? parseOFX(text) : parseCSV(text);
      if (txs.length === 0) {
        setErroParse(`Nenhuma transação detectada. Verifique se o arquivo é um ${formato.toUpperCase()} válido.`);
        return;
      }
      // Ordena mais recentes primeiro
      txs.sort((a, b) => b.data.localeCompare(a.data));
      setTransacoes(txs);
      setSelecionadas(new Set(txs.map((_, i) => i)));
    } catch (e: any) {
      setErroParse('Erro ao ler o arquivo: ' + (e.message || 'desconhecido'));
    }
  }

  function toggleSel(i: number) {
    setSelecionadas(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }
  function selecionarTodas() {
    setSelecionadas(new Set(transacoes.map((_, i) => i)));
  }
  function limparSelecao() {
    setSelecionadas(new Set());
  }

  async function importar() {
    setErro('');
    if (selecionadas.size === 0) { setErro('Selecione pelo menos uma transação.'); return; }
    if (!walletId) { setErro('Escolha a conta destino.'); return; }

    const wallet = wallets.find(w => w.id === walletId);
    const escolhidas = Array.from(selecionadas).map(i => transacoes[i]);
    const body = {
      phone,
      transacoes: escolhidas.map(t => ({
        data:          t.data,
        tipo:          t.tipo,
        valor:         t.valor,
        observacao:    t.observacao,
        carteira_nome: wallet?.nome || 'Dinheiro',
        categoria:     '📦 Importado',
        pago:          true,
      })),
    };

    setImportando(true);
    try {
      const r = await api.transacoes.criarBulk(body);
      onSuccess(r.inserted);
      onClose();
    } catch (e: any) {
      setErro(e.message || 'Erro ao importar.');
    } finally {
      setImportando(false);
    }
  }

  // Resumo
  const resumo = useMemo(() => {
    const sel = Array.from(selecionadas).map(i => transacoes[i]).filter(Boolean);
    const receitas = sel.filter(t => t.tipo === 'Recebimento').reduce((s, t) => s + t.valor, 0);
    const gastos   = sel.filter(t => t.tipo === 'Gasto').reduce((s, t) => s + t.valor, 0);
    return { qtd: sel.length, receitas, gastos };
  }, [selecionadas, transacoes]);

  const walletsImportaveis = wallets.filter(w => w.tipo !== 'Crédito');

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-2xl bg-card rounded-3xl shadow-2xl overflow-hidden animate-fade-in border border-border max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/15">
              <Upload size={20} className="text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground leading-tight">
                Importar {formato.toUpperCase()}
              </h2>
              <p className="text-xs text-muted-foreground truncate">
                {formato === 'ofx'
                  ? 'Extrato bancário no formato OFX (Open Financial Exchange)'
                  : 'Planilha CSV com colunas Data, Descrição e Valor'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors flex-shrink-0">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Drop / picker zone */}
          {transacoes.length === 0 && (
            <div>
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-all p-8 flex flex-col items-center justify-center gap-3 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileText size={24} className="text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">
                    Clique para escolher o arquivo
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formato === 'ofx' ? 'Aceita .ofx' : 'Aceita .csv ou .txt'} (até 5 MB)
                  </p>
                </div>
              </button>
              <input
                ref={fileRef} type="file" accept={aceitarExt} hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
              />

              {/* Dicas */}
              <div className="mt-4 rounded-xl p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60">
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 mb-1.5">
                  Onde baixo esse arquivo?
                </p>
                <p className="text-[11px] text-blue-700/90 dark:text-blue-300/90 leading-relaxed">
                  No app do seu banco, abre o extrato → toca em <strong>"Exportar"</strong> ou <strong>"Compartilhar"</strong> → escolhe <strong>{formato === 'ofx' ? 'OFX' : 'CSV / Excel'}</strong>. Todos os bancos brasileiros são obrigados por lei a oferecer essa exportação.
                </p>
              </div>

              {erroParse && (
                <div className="mt-3 rounded-xl p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5">
                  <AlertCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">{erroParse}</p>
                </div>
              )}
            </div>
          )}

          {/* Preview de transações */}
          {transacoes.length > 0 && (
            <>
              {/* Arquivo + conta destino */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={14} className="text-muted-foreground flex-shrink-0" />
                  <p className="text-xs text-foreground truncate font-medium">{arquivoNome}</p>
                  <button onClick={() => { setTransacoes([]); setArquivoNome(''); }}
                          className="text-[11px] text-muted-foreground hover:text-foreground underline">
                    Trocar arquivo
                  </button>
                </div>
                <p className="text-xs text-muted-foreground tabular">
                  <strong className="text-foreground">{transacoes.length}</strong> transaç{transacoes.length === 1 ? 'ão' : 'ões'} encontradas
                </p>
              </div>

              {/* Conta destino — picker visual */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                  Conta destino
                </label>
                {walletsImportaveis.length === 0 ? (
                  <div className="rounded-xl p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-700 dark:text-amber-300">
                    Você não tem contas bancárias cadastradas. <a href="/contas-bancarias" className="underline font-semibold">Criar agora</a>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                    {walletsImportaveis.map(w => {
                      const logo = bancoLogo(w.nome);
                      const ativa = w.id === walletId;
                      return (
                        <button
                          key={w.id}
                          onClick={() => setWalletId(w.id)}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                            ativa ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                                  : 'border-border bg-muted/20 hover:border-primary/40'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                               style={{ background: logo.bg }}>
                            {logo.text}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">{w.nome}</p>
                            <p className="text-[10px] text-muted-foreground">{w.tipo}</p>
                          </div>
                          {ativa && <Check size={14} className="text-primary flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Controles de seleção */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">{selecionadas.size}</strong> selecionada{selecionadas.size !== 1 ? 's' : ''} de {transacoes.length}
                </p>
                <div className="flex gap-1.5">
                  <button onClick={selecionarTodas} className="btn-ghost px-2.5 py-1 text-[11px]">Selecionar todas</button>
                  <button onClick={limparSelecao}   className="btn-ghost px-2.5 py-1 text-[11px]">Limpar</button>
                </div>
              </div>

              {/* Tabela de preview */}
              <div className="rounded-2xl border border-border overflow-hidden">
                <div className="max-h-[40vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 sticky top-0 z-10">
                      <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="w-10 px-2 py-2"></th>
                        <th className="text-left px-2 py-2 font-bold">Data</th>
                        <th className="text-left px-2 py-2 font-bold">Descrição</th>
                        <th className="text-right px-3 py-2 font-bold">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {transacoes.map((t, i) => {
                        const sel = selecionadas.has(i);
                        const ehGasto = t.tipo === 'Gasto';
                        return (
                          <tr key={i} onClick={() => toggleSel(i)}
                              className={`cursor-pointer transition-colors ${sel ? 'bg-primary/5' : 'hover:bg-muted/30'}`}>
                            <td className="px-2 py-2 text-center">
                              <input type="checkbox" checked={sel} onChange={() => toggleSel(i)}
                                     className="w-4 h-4 accent-primary cursor-pointer" />
                            </td>
                            <td className="px-2 py-2 text-muted-foreground tabular text-xs">{fmtData(t.data)}</td>
                            <td className="px-2 py-2 text-foreground text-xs truncate max-w-[280px]">{t.observacao}</td>
                            <td className="px-3 py-2 text-right">
                              <span className={`tabular font-bold text-xs inline-flex items-center gap-1 ${
                                ehGasto ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                              }`}>
                                {ehGasto ? <ArrowDownRight size={11} /> : <ArrowUpRight size={11} />}
                                {fmt(t.valor)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Resumo */}
              {resumo.qtd > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <ResumoCard label="Selecionadas" value={String(resumo.qtd)} />
                  <ResumoCard label="Receitas"     value={fmt(resumo.receitas)} cor="#22c55e" />
                  <ResumoCard label="Gastos"       value={fmt(resumo.gastos)}   cor="#ef4444" />
                </div>
              )}

              {erro && (
                <div className="rounded-xl p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5">
                  <AlertCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">{erro}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {transacoes.length > 0 && (
          <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-border bg-muted/20">
            <p className="text-[11px] text-muted-foreground">
              Tudo será marcado como <strong className="text-foreground">📦 Importado</strong> — você pode recategorizar depois.
            </p>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
              <button onClick={importar}
                      disabled={importando || selecionadas.size === 0 || !walletId}
                      className="btn btn-primary px-4 py-2 text-sm gap-2 shadow-glow-sm whitespace-nowrap">
                {importando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Importar {selecionadas.size > 0 ? `(${selecionadas.size})` : ''}
              </button>
            </div>
          </div>
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
