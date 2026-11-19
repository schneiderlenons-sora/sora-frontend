'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Loader2, Upload, FileText, AlertCircle, Check, ArrowUpRight, ArrowDownRight, Pencil, Trash2, ArrowLeft, Copy } from 'lucide-react';
import { api } from '@/lib/api';
import { categorizarDescricao } from '@/lib/categorizar';
import { nomeCategoria } from '@/lib/categorias';
import { bancoLogo } from '@/components/cartoes/AdicionarCartaoModal';
import { useDinheiro } from '@/lib/moeda-base';
// Planilha (CSV ou Excel) sai de um parser só — ver lib/importar-tabela.ts.
import { analisarCSV, analisarTabela, ehPlanilhaExcel, ehPagamentoDaFatura, type TxParsed, type Celula, type ResultadoTabela } from '@/lib/importar-tabela';
// PDF (fatura/extrato): a extração de texto roda no servidor (/api/importar/pdf,
// pdf.js em Node); aqui só interpretamos as linhas. Ver lib/importar-pdf.ts.
import { parsePdfLinhas, motivoPdfSemLancamentos, pdfEhFatura } from '@/lib/importar-pdf';
import { parseNumeroDigitado, numeroParaCampo } from '@/lib/formato-br';

// ─────────────────────────────────────────────────────────────
// PARSERS
// ─────────────────────────────────────────────────────────────

function parseOFXDate(s: string): string | null {
  if (!s) return null;
  // OFX: YYYYMMDDHHmmss[timezone] ou só YYYYMMDD
  const m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

// Valor do OFX → número. Cobre "50.00" (padrão), "50,00" e "1.234,56" — alguns
// bancos BR exportam o TRNAMT com vírgula decimal.
function parseOFXAmount(s: string): number {
  let v = (s || '').trim();
  if (!v) return NaN;
  if (/,\d{1,2}$/.test(v)) v = v.replace(/\./g, '').replace(',', '.');
  return parseFloat(v);
}

export function parseOFX(text: string): TxParsed[] {
  const txns: TxParsed[] = [];
  // ⚠️ NÃO dá pra depender de <STMTTRN>...</STMTTRN>: muitos bancos BR exportam
  // OFX em SGML SEM as tags de fechamento (</STMTTRN>). Então dividimos por
  // <STMTTRN> e cada bloco vai até o próximo <STMTTRN>, o </STMTTRN> OU o fim da
  // lista — o que vier primeiro. Cobre os dois formatos (com e sem fechamento).
  const partes = text.split(/<STMTTRN>/i).slice(1);
  for (const parte of partes) {
    const block = parte.split(/<\/STMTTRN>|<\/BANKTRANLIST>|<STMTTRN>/i)[0];
    const get = (tag: string) => {
      const r = block.match(new RegExp(`<${tag}>\\s*([^<\\r\\n]*)`, 'i'));
      return r ? r[1].trim() : '';
    };
    const data = parseOFXDate(get('DTPOSTED'));
    const amt = parseOFXAmount(get('TRNAMT'));
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

// ⚠️ CSV salvo pelo Excel em português vem em WINDOWS-1252, não UTF-8. Lido
// como UTF-8, "Descrição" virava "Descri��o" e todo acento das descrições
// quebrava. Tenta UTF-8 ESTRITO primeiro; se não for, é 1252.
async function lerTexto(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch { return new TextDecoder('windows-1252').decode(buf); }
}

// ─────────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────────

const fmtData = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');

/** O que a importação fez — a tela de Transações monta o aviso a partir disto. */
export type ResultadoImportacao = { inserted: number; duplicados: number; movidas: number; conta: string };

interface Props {
  phone:   string;
  wallets: any[];
  formato: 'ofx' | 'csv' | 'pdf';
  onClose:   () => void;
  onSuccess: (r: ResultadoImportacao) => void;
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
  // Já importada (mesmo FITID) noutra conta do grupo: o nome dela.
  jaEm?:      string;
  // Pagamento da fatura dentro da fatura: desmarcado (não é receita).
  pagamentoFatura?: boolean;
  editando:   boolean;
};

// Fatura de cartão em OFX: o extrato do cartão vem em <CCSTMTRS> (o de conta, em <STMTRS>).
const OFX_DE_CARTAO = /<(CCSTMTRS|CREDITCARDMSGSRSV1)>/i;

const CAT_IMPORTADO = '📦 Importado';

export default function ImportarModal({ phone, wallets, formato, onClose, onSuccess }: Props) {
  const fmt = useDinheiro();
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
  // O arquivo fica guardado: trocar a conta na revisão reanalisa sem pedir de novo.
  const [arquivo, setArquivo] = useState<File | null>(null);
  // A pessoa tocou numa conta? Sem isso a conta é a que a tela pré-escolheu
  // (a corrente) e um arquivo de CARTÃO pode trocá-la sozinho.
  const [escolhaManual, setEscolhaManual] = useState(false);
  const [cartaoArquivo, setCartaoArquivo] = useState(false);
  const [trocouConta, setTrocouConta] = useState<string | null>(null);
  const [invertido, setInvertido] = useState(false);
  const [moverOutras, setMoverOutras] = useState(true);

  // ⚠️ EXTENSÃO SOZINHA NÃO BASTA NO ANDROID. O `accept` vira filtro por tipo
  // de arquivo, e o gerenciador do Redmi (e outros) marca CSV como
  // "text/comma-separated-values" ou "application/vnd.ms-excel" — sem o tipo na
  // lista o arquivo aparece CINZA e não dá pra tocar (relato de set/2026). OFX
  // costuma nem ter tipo registrado, daí o octet-stream. Aceitar a mais é
  // seguro: o conteúdo é validado depois, com mensagem clara.
  const aceitarExt = formato === 'ofx'
    ? '.ofx,.OFX,.qfx,application/x-ofx,application/ofx,application/vnd.intu.qfx,application/octet-stream'
    : formato === 'pdf'
    ? '.pdf,.PDF,application/pdf'
    : [
        '.csv', '.CSV', '.txt', '.xlsx', '.XLSX',
        'text/csv', 'text/comma-separated-values', 'application/csv', 'text/plain',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ].join(',');
  const nomeFormato = formato === 'ofx' ? 'OFX' : formato === 'pdf' ? 'PDF' : 'planilha';
  const walletNome = wallets.find(w => w.id === walletId)?.nome || 'Dinheiro';

  // Carrega categorias pra o seletor da revisão
  useEffect(() => {
    if (!phone) return;
    api.categorias.listar(phone)
      .then((cs: any[]) => setCategorias([CAT_IMPORTADO, ...(cs || [])
        .map(c => c.nome).filter(Boolean)
        .sort((a, b) => nomeCategoria(a).localeCompare(nomeCategoria(b), 'pt-BR'))]))
      .catch(() => setCategorias([CAT_IMPORTADO]));
  }, [phone]);

  /**
   * Lê o arquivo e monta a revisão. `contaEscolhida` vem quando a pessoa troca
   * a conta NA REVISÃO: aí a escolha é dela e o arquivo não troca a conta sozinho.
   */
  async function handleFile(file: File, contaEscolhida?: string) {
    setArquivo(file);
    setArquivoNome(file.name);
    setErroParse('');
    setTrocouConta(null);
    // PDF sobe pro servidor (limite da Vercel ~4,5 MB); OFX/planilha são lidos aqui.
    const limiteMB = formato === 'pdf' ? 4 : 5;
    if (file.size > limiteMB * 1024 * 1024) {
      setErroParse(formato === 'pdf'
        ? 'PDF muito grande (máx. 4 MB). Se for maior, exporte em OFX ou planilha.'
        : 'Arquivo muito grande (máx. 5 MB).');
      return;
    }
    let wId = contaEscolhida || walletId;
    if (!wId) { setErroParse('Selecione a conta destino antes de escolher o arquivo.'); return; }
    const contaDe = (id: string) => wallets.find((w) => w.id === id);

    setAnalisando(true);
    try {
      if (formato === 'csv' && /\.xls$/i.test(file.name)) {
        setErroParse('Esse é o formato antigo do Excel (.xls). Abra no Excel ou no Google Planilhas e salve como .xlsx ou CSV.');
        setAnalisando(false);
        return;
      }
      let txs: TxParsed[];
      let ehCartao = false;
      let inv = false;
      // Planilha relida quando a conta muda pra um cartão (o sinal depende disso).
      let lerPlanilha: ((cartao: boolean) => ResultadoTabela) | null = null;
      if (formato === 'pdf') {
        // Extração no servidor (pdf.js em Node); o parse e a revisão são aqui.
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/importar/pdf', { method: 'POST', body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErroParse(data.erro || 'Não consegui ler o PDF. Tente OFX ou planilha.');
          setAnalisando(false);
          return;
        }
        const linhasPdf: string[] = Array.isArray(data.linhas) ? data.linhas : [];
        txs = parsePdfLinhas(linhasPdf);
        ehCartao = pdfEhFatura(linhasPdf);
        if (txs.length === 0) {
          // ⚠️ Só diz "imagem" quando NÃO há texto. Um PDF com texto num layout
          // que não sabemos ler era chamado de imagem — e o cliente tentava em
          // vão exportar de novo (relato de nov/2026).
          setErroParse(motivoPdfSemLancamentos(linhasPdf) === 'sem_texto'
            ? 'Este PDF não tem texto pra ler: parece uma imagem escaneada. No app do banco, exporte a fatura ou o extrato em OFX ou em planilha (CSV).'
            : 'Não reconheci os lançamentos neste PDF (cada banco monta o arquivo de um jeito). No app do banco, exporte em OFX: ele traz cada lançamento certinho.');
          setAnalisando(false);
          return;
        }
      } else if (formato === 'ofx') {
        const texto = await lerTexto(file);
        txs = parseOFX(texto);
        ehCartao = OFX_DE_CARTAO.test(texto);
      } else {
        if (ehPlanilhaExcel(file.name)) {
          // Carregado só aqui: quem nunca importa Excel não baixa o leitor.
          const { default: readXlsxFile } = await import('read-excel-file/browser');
          const folhas = await readXlsxFile(file);
          // Usa a aba com MAIS lançamentos — app que exporta resumo numa aba e
          // extrato em outra não pode cair na aba errada.
          lerPlanilha = (cartao) => folhas
            .map((f) => analisarTabela(f.data as unknown as Celula[][], { cartao }))
            .sort((a, b) => b.txs.length - a.txs.length)[0] || { txs: [], cartao: false, invertido: false };
        } else {
          const texto = await lerTexto(file);
          lerPlanilha = (cartao) => analisarCSV(texto, { cartao });
        }
        const r = lerPlanilha(contaDe(wId)?.tipo === 'Crédito');
        txs = r.txs; ehCartao = r.cartao; inv = r.invertido;
      }

      // ⚠️ FATURA DE CARTÃO NA CONTA CORRENTE: a tela abre com a corrente já
      // escolhida, e foi assim que uma fatura inteira foi parar lá (relato de
      // nov/2026). Se a pessoa não escolheu a conta e há UM cartão só, vai pra
      // ele; com mais de um, a revisão avisa e deixa trocar.
      if (ehCartao && contaDe(wId)?.tipo !== 'Crédito' && !escolhaManual && !contaEscolhida) {
        const cartoes = wallets.filter((w) => w.tipo === 'Crédito');
        if (cartoes.length === 1) {
          wId = cartoes[0].id;
          setWalletId(wId);
          setTrocouConta(cartoes[0].nome);
          if (lerPlanilha) { const r = lerPlanilha(true); txs = r.txs; inv = r.invertido; }
        }
      }

      if (txs.length === 0) {
        setErroParse(
          formato === 'ofx'
            ? 'Nenhuma transação detectada. Verifique se o arquivo é um OFX válido.'
            : 'Nenhuma transação detectada. A planilha precisa de uma coluna de DATA e uma de VALOR (ou de Entrada e Saída).');
        setAnalisando(false);
        return;
      }
      txs.sort((a, b) => b.data.localeCompare(a.data));
      const contaAlvo = contaDe(wId);
      const nomeAlvo = contaAlvo?.nome || 'Dinheiro';
      const destinoEhCartao = contaAlvo?.tipo === 'Crédito';

      // Duplicatas, de dois jeitos:
      //  · MESMO FITID em qualquer conta do grupo — é o que o servidor confere.
      //    ⚠️ Antes a tela só olhava a conta escolhida: o lançamento importado
      //    noutra conta aparecia como novo, e o servidor respondia "0
      //    importadas" sem explicar. Agora a tela diz ONDE ele está e oferece
      //    mover pra conta escolhida.
      //  · mesma data + valor + tipo na conta escolhida (lançado à mão).
      let todas: any[] = [];
      try {
        const r = await api.transacoes.listar(phone, { limit: 800 });
        todas = r.transacoes || [];
      } catch { /* sem rede — segue sem dedup heurística */ }
      const contaDaTx = (t: any) => t.carteira_nome || t.wallet_nome;
      const ondeFitid = new Map<string, string>();
      for (const t of todas) if (t.fitid) ondeFitid.set(String(t.fitid), contaDaTx(t));
      const chave = (d: string, v: number, tp: string) => `${d}|${v.toFixed(2)}|${tp}`;
      const existSet = new Set(todas.filter((t: any) => contaDaTx(t) === nomeAlvo)
        .map((t: any) => chave(String(t.data).slice(0, 10), Math.abs(t.valor || 0), t.tipo)));

      const novas: Row[] = txs.map(t => {
        const ja = t.fitid ? ondeFitid.get(t.fitid) : undefined;
        const jaEm = ja && ja !== nomeAlvo ? ja : undefined;
        const dup = !!ja || existSet.has(chave(t.data, t.valor, t.tipo));
        const pagamentoFatura = (ehCartao || destinoEhCartao) && t.tipo === 'Recebimento' && ehPagamentoDaFatura(t.observacao);
        // Auto-categoriza pela descrição ("AMAZONMD" → Amazon, "IFOOD*" → iFood…).
        // Só sugere pra despesas; receitas ficam como Importado pra revisão.
        const sugerida = t.tipo === 'Gasto' ? categorizarDescricao(t.observacao) : null;
        return {
          ...t, categoria: sugerida || CAT_IMPORTADO, selecionada: !dup && !pagamentoFatura,
          dup, jaEm, pagamentoFatura, editando: false,
        };
      });
      setCartaoArquivo(ehCartao);
      setInvertido(inv);
      setMoverOutras(true);
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
    const paraMover = moverOutras ? rows.filter(r => r.jaEm && r.fitid).map(r => r.fitid as string) : [];
    if (escolhidas.length === 0 && paraMover.length === 0) { setErro('Selecione pelo menos uma transação.'); return; }
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
        mover_fitids: paraMover,
        carteira_destino: walletNome,
      });
      onSuccess({ inserted: r.inserted || 0, duplicados: r.duplicados || 0, movidas: r.movidas || 0, conta: walletNome });
      onClose();
    } catch (e: any) {
      setErro(e.message || 'Erro ao importar.');
    } finally {
      setImportando(false);
    }
  }

  const selecionadas = rows.filter(r => r.selecionada);
  // Duplicata NA PRÓPRIA conta (lançada à mão ou importada antes nela).
  const dupCount = rows.filter(r => r.dup && !r.jaEm).length;
  const emOutras = rows.filter(r => r.jaEm);
  const contasOutras = Array.from(new Set(emOutras.map(r => r.jaEm as string)));
  const qtdMover = moverOutras ? emOutras.filter(r => r.fitid).length : 0;
  const qtdPagamentos = rows.filter(r => r.pagamentoFatura).length;
  const contaAtual = wallets.find(w => w.id === walletId);
  const cartaoNaContaErrada = cartaoArquivo && contaAtual?.tipo !== 'Crédito';
  const listaContas = (ns: string[]) => ns.length <= 1 ? (ns[0] || '') : `${ns.slice(0, -1).join(', ')} e ${ns[ns.length - 1]}`;

  /** Trocar a conta NA REVISÃO: reanalisa o mesmo arquivo pra conta nova. */
  function trocarConta(id: string) {
    setEscolhaManual(true);
    setWalletId(id);
    if (arquivo) void handleFile(arquivo, id);
  }
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
                {step === 'upload' ? `Importar ${nomeFormato}` : 'Revisar transações'}
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
                      <button key={w.id} onClick={() => { setWalletId(w.id); setEscolhaManual(true); }}
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
                2. Escolha o arquivo {formato === 'ofx' ? 'OFX' : formato === 'pdf' ? 'PDF' : 'CSV ou Excel'}
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
                  <p className="text-xs text-muted-foreground mt-1">{formato === 'ofx' ? 'Aceita .ofx' : formato === 'pdf' ? 'Aceita .pdf (fatura/extrato)' : 'Aceita .csv, .txt ou .xlsx (Excel)'} (até 5 MB)</p>
                </div>
              </button>
              <input ref={fileRef} type="file" accept={aceitarExt} hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
            </div>

            <div className="rounded-xl p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 mb-1.5">Onde baixo esse arquivo?</p>
              <p className="text-[11px] text-blue-700/90 dark:text-blue-300/90 leading-relaxed">
                No app do seu banco: extrato/fatura → <strong>"Exportar/Compartilhar"</strong> → <strong>{formato === 'ofx' ? 'OFX' : formato === 'pdf' ? 'PDF' : 'CSV/Excel'}</strong>.
                {formato === 'csv' && <> Vindo de <strong>outro app de finanças</strong>? Exporte em Excel ou CSV — reconhecemos colunas de data, descrição, valor e tipo (despesa/receita).</>}
                {formato === 'pdf' && <> ⚠️ O PDF é <strong>lido de forma aproximada</strong> (cada banco diagrama diferente) — <strong>confira os lançamentos</strong> no próximo passo antes de salvar. Se vier incompleto, prefira <strong>OFX</strong> ou <strong>CSV/Excel</strong>, que são mais exatos. PDF <strong>escaneado (imagem)</strong> não dá pra ler.</>}
                {' '}Transações que você já tem na conta são detectadas e marcadas como duplicadas no próximo passo.
              </p>
            </div>

            {formato === 'ofx' && (
              <div className="rounded-xl p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1.5">⚠️ Nem todo banco tem OFX</p>
                <p className="text-[11px] text-amber-700/90 dark:text-amber-300/90 leading-relaxed">
                  Algumas <strong>carteiras digitais não exportam OFX de verdade</strong> — só PDF ou planilha. O <strong>Mercado Pago</strong> é o caso mais comum (outras carteiras, como o PicPay, também costumam só ter PDF/planilha). Nesses casos o arquivo não é lido — use a importação por <strong>CSV/Excel</strong>. Já bancos como <strong>Nubank, Inter, Itaú, Bradesco, Banco do Brasil, Caixa, Santander e C6</strong> exportam OFX normalmente.
                </p>
              </div>
            )}

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
              {/* A conta pode ser trocada AQUI: reanalisa o mesmo arquivo. Antes só
                  dava pra escolher no passo 1, onde a corrente já vem marcada. */}
              <label className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                <span>Importar na conta</span>
                <select value={walletId} onChange={e => trocarConta(e.target.value)} disabled={analisando}
                  className="h-10 min-w-0 max-w-full px-2.5 rounded-xl bg-background border border-border text-sm font-semibold text-foreground focus:outline-none focus:border-primary">
                  {wallets.map(w => <option key={w.id} value={w.id}>{w.nome}{w.tipo === 'Crédito' ? ' (cartão)' : ''}</option>)}
                </select>
                {analisando && <Loader2 size={14} className="animate-spin text-primary" />}
              </label>

              {trocouConta && (
                <div className="rounded-xl p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 flex items-start gap-2.5">
                  <Check size={15} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
                    Este arquivo é uma fatura de cartão, então escolhemos a conta <strong>{trocouConta}</strong>. Se for outro cartão, troque acima.
                  </p>
                </div>
              )}

              {cartaoNaContaErrada && (
                <div className="rounded-xl p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex items-start gap-2.5" role="alert">
                  <AlertCircle size={15} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                    Este arquivo parece ser uma <strong>fatura de cartão de crédito</strong>, mas a conta escolhida é <strong>{walletNome}</strong>. Escolha o cartão acima antes de importar.
                  </p>
                </div>
              )}

              {emOutras.length > 0 && (
                <div className="rounded-xl p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <Copy size={15} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                      <strong>{emOutras.length}</strong> transaç{emOutras.length === 1 ? 'ão deste arquivo já foi importada' : 'ões deste arquivo já foram importadas'} na conta <strong>{listaContas(contasOutras)}</strong>.
                    </p>
                  </div>
                  <label className="flex items-center gap-2.5 pl-[25px] min-h-[44px] cursor-pointer">
                    <input type="checkbox" checked={moverOutras} onChange={() => setMoverOutras(v => !v)} className="w-4 h-4 accent-primary" />
                    <span className="text-[12px] font-semibold text-amber-800 dark:text-amber-200">
                      Mover para {walletNome}
                    </span>
                  </label>
                </div>
              )}

              {invertido && (
                <div className="rounded-xl p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 flex items-start gap-2.5">
                  <ArrowDownRight size={15} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
                    Nesta fatura as compras vêm com valor positivo, então entraram como <strong>gasto</strong>. Confira antes de importar.
                  </p>
                </div>
              )}

              {qtdPagamentos > 0 && (
                <div className="rounded-xl p-3 bg-muted/40 border border-border flex items-start gap-2.5">
                  <AlertCircle size={15} className="text-muted-foreground flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {qtdPagamentos === 1 ? 'O pagamento da fatura ficou desmarcado' : `Os ${qtdPagamentos} pagamentos da fatura ficaram desmarcados`}: pagar a fatura não é receita, o dinheiro saiu da sua conta.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">{selecionadas.length}</strong> de {rows.length} selecionada{selecionadas.length !== 1 ? 's' : ''}
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
                    <strong>{dupCount}</strong> transaç{dupCount === 1 ? 'ão parece' : 'ões parecem'} já estar nesta conta — desmarcamos pra você não duplicar. Confira e marque se quiser importar mesmo assim.
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
                          <p className="text-[10px] text-muted-foreground truncate">
                            {r.categoria}
                            {r.jaEm
                              ? <span className="text-amber-600 dark:text-amber-400 font-semibold"> · já importada em {r.jaEm}</span>
                              : r.dup && <span className="text-amber-600 dark:text-amber-400 font-semibold"> · possível duplicata</span>}
                            {r.pagamentoFatura && <span className="font-semibold"> · pagamento da fatura</span>}
                          </p>
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
                            {/* ⚠️ Lido ao SAIR do campo, não a cada tecla: controlado e
                                reconvertido por tecla, "12," virava "12" na hora — a
                                vírgula sumia e era impossível digitar centavos. `key`
                                recria o campo se o valor mudar por fora. */}
                            <input type="text" inputMode="decimal" key={`${i}:${r.valor}`}
                              defaultValue={numeroParaCampo(r.valor, 2)}
                              onBlur={e => {
                                const v = parseNumeroDigitado(e.target.value);
                                if (Number.isFinite(v) && Math.abs(v) !== r.valor) patchRow(i, { valor: Math.abs(v) });
                                else e.target.value = numeroParaCampo(r.valor, 2);   // inválido: volta ao valor atual
                              }}
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
                <button onClick={importar} disabled={importando || analisando || (resumo.qtd === 0 && qtdMover === 0)}
                  className="btn btn-primary px-4 py-2 text-sm gap-2 shadow-glow-sm whitespace-nowrap">
                  {importando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {resumo.qtd > 0 ? `Importar (${resumo.qtd})` : 'Importar'}
                  {qtdMover > 0 ? ` · mover ${qtdMover}` : ''}
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
