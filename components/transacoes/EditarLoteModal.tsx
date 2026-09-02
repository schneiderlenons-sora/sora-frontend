'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api';
import { nomeCategoria } from '@/lib/categorias';
import { X, Tag, Landmark, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';

// =============================================================================
// Edição em LOTE das transações selecionadas.
//
// Pedido de cliente: "o sistema permite selecionar múltiplos lançamentos, mas
// não disponibiliza a alteração conjunta de campos como categoria, conta e
// status".
//
// ⚠️ CAMPO EM BRANCO = NÃO MEXE. O patch leva só o que o usuário preencheu.
// Numa edição de 200 linhas, mandar um campo "vazio" por engano sobrescreveria
// 200 categorias boas — por isso nada aqui tem valor padrão, e o botão fica
// desabilitado enquanto nenhum campo foi escolhido.
//
// ⚠️ Via createPortal(document.body): a barra de seleção vive dentro de um card
// com backdrop-blur, e um ancestral com backdrop-filter vira o containing block
// do position:fixed — o modal ficaria preso dentro do card. Regra do CLAUDE.md.
// =============================================================================

const BRAND = 'hsl(var(--primary))';

export type PatchLote = { categoria?: string; carteira_nome?: string; pago?: boolean };

export default function EditarLoteModal({
  phone, quantidade, wallets, onClose, onAplicar,
}: {
  phone: string;
  quantidade: number;
  wallets: Array<{ id: string; nome: string; tipo?: string }>;
  onClose: () => void;
  onAplicar: (patch: PatchLote) => Promise<void>;
}) {
  const [montado, setMontado] = useState(false);
  const [cats, setCats] = useState<string[]>([]);
  const [categoria, setCategoria] = useState('');
  const [conta, setConta] = useState('');
  const [status, setStatus] = useState<'' | 'pago' | 'pendente'>('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => { setMontado(true); }, []);

  // Catálogo COMPLETO do grupo — não só as categorias que aparecem no mês.
  // Mover 40 lançamentos para uma categoria que ainda não foi usada é
  // justamente um dos motivos de editar em lote.
  useEffect(() => {
    api.categorias.listar(phone)
      .then((r: any) => setCats((Array.isArray(r) ? r : r?.categorias || []).map((c: any) => c.nome).filter(Boolean)))
      .catch(() => { /* sem catálogo, o seletor fica vazio e os outros campos seguem */ });
  }, [phone]);

  const patch: PatchLote = {};
  if (categoria) patch.categoria = categoria;
  if (conta) patch.carteira_nome = conta;
  if (status) patch.pago = status === 'pago';
  const nMudancas = Object.keys(patch).length;

  async function aplicar() {
    if (!nMudancas) return;
    setSalvando(true); setErro('');
    try { await onAplicar(patch); onClose(); }
    catch (e: any) { setErro(e?.message || 'Não consegui aplicar. Tente de novo.'); }
    finally { setSalvando(false); }
  }

  if (!montado) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border animate-fade-in max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label="Editar transações selecionadas"
      >
        <header className="flex items-start gap-3 p-5 pb-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-foreground leading-tight">Editar em lote</h3>
            <p className="text-xs text-muted-foreground mt-0.5 tabular">
              {quantidade} transaç{quantidade > 1 ? 'ões' : 'ão'} selecionada{quantidade > 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose} aria-label="Fechar"
            className="grid place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex-shrink-0"
            style={{ width: 40, height: 40 }}>
            <X size={18} />
          </button>
        </header>

        <div className="px-5 pb-5 space-y-4">
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Só os campos que você preencher são alterados. O que ficar em
            <strong className="text-foreground"> &ldquo;não alterar&rdquo;</strong> permanece como está em cada lançamento.
          </p>

          <Campo icone={<Tag size={14} />} rotulo="Categoria">
            <select className="input" value={categoria} onChange={(e) => setCategoria(e.target.value)}
                    style={{ minHeight: 44 }}>
              <option value="">Não alterar</option>
              {cats.map((c) => <option key={c} value={c}>{nomeCategoria(c)}</option>)}
            </select>
          </Campo>

          <Campo icone={<Landmark size={14} />} rotulo="Conta">
            <select className="input" value={conta} onChange={(e) => setConta(e.target.value)}
                    style={{ minHeight: 44 }}>
              <option value="">Não alterar</option>
              {wallets.map((w) => <option key={w.id} value={w.nome}>{w.nome}</option>)}
            </select>
          </Campo>

          <Campo icone={<CheckCircle2 size={14} />} rotulo="Status">
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as any)}
                    style={{ minHeight: 44 }}>
              <option value="">Não alterar</option>
              <option value="pago">Pago / Recebido</option>
              <option value="pendente">Pendente</option>
            </select>
          </Campo>

          {/* ⚠️ Conta e status mexem em SALDO — o backend reconcilia por
              transação, mas o usuário precisa saber que não é só um rótulo. */}
          {(conta || status) && (
            <div className="flex items-start gap-2 rounded-2xl p-3 bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-900/50">
              <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-[12px] leading-snug text-amber-800 dark:text-amber-200">
                {conta && 'Trocar a conta move os lançamentos e recalcula o saldo das duas contas. '}
                {status && 'Mudar o status altera o saldo da conta de cada lançamento.'}
              </p>
            </div>
          )}

          {erro && (
            <p className="text-[13px] text-red-600 dark:text-red-400 leading-snug">{erro}</p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button onClick={onClose} className="btn-ghost px-4 text-sm flex-1" style={{ minHeight: 44 }}>
              Cancelar
            </button>
            <button
              onClick={aplicar}
              disabled={!nMudancas || salvando}
              className="btn btn-primary px-4 text-sm flex-1 gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: 44, background: BRAND }}
            >
              {salvando ? <><Loader2 size={15} className="animate-spin" /> Aplicando…</>
                : nMudancas ? `Aplicar em ${quantidade}` : 'Escolha um campo'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Campo({ icone, rotulo, children }: { icone: React.ReactNode; rotulo: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
        {icone} {rotulo}
      </span>
      {children}
    </label>
  );
}
