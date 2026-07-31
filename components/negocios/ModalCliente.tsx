'use client';

// Cadastro de cliente. O telefone é o campo que mais importa: é por ele que a
// Sora cobra e conversa. Por isso ele vem logo depois do nome, com máscara e
// teclado numérico — e não escondido em "mais detalhes".

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, AlertCircle, Trash2, Check } from 'lucide-react';
import { api } from '@/lib/api';
import type { ClienteNegocio } from '@/lib/lancamentos';

/** Máscara BR enquanto digita: (32) 99916-7475 */
function mascara(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2)  return d;
  if (d.length <= 6)  return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function ModalCliente({
  empresaId, cor, cliente, onClose, onSalvo,
}: {
  empresaId: string; cor: string;
  cliente?: ClienteNegocio | null;   // null = criar
  onClose: () => void; onSalvo: () => void;
}) {
  const editando = !!cliente?.id;

  const [nome, setNome]           = useState(cliente?.nome || '');
  const [telefone, setTelefone]   = useState(mascara(cliente?.telefone || ''));
  const [email, setEmail]         = useState(cliente?.email || '');
  const [documento, setDocumento] = useState(cliente?.documento || '');
  const [endereco, setEndereco]   = useState(cliente?.endereco || '');
  const [observacao, setObs]      = useState(cliente?.observacao || '');
  const [salvando, setSalvando]   = useState(false);
  const [erro, setErro]           = useState('');

  const [montado, setMontado] = useState(false);
  useEffect(() => { setMontado(true); }, []);

  async function salvar() {
    if (salvando) return;
    setErro('');
    if (!nome.trim()) { setErro('Informe o nome do cliente.'); return; }

    setSalvando(true);
    try {
      const body = {
        empresa_id: empresaId,
        nome: nome.trim(),
        telefone: telefone.replace(/\D/g, '') || undefined,
        email: email.trim() || undefined,
        documento: documento.trim() || undefined,
        endereco: endereco.trim() || undefined,
        observacao: observacao.trim() || undefined,
      };
      if (editando) await api.negocios.clientes.editar(cliente!.id, body);
      else await api.negocios.clientes.criar(body);
      onSalvo();
    } catch (e: any) {
      setErro(e?.message || 'Não consegui salvar.');
    } finally { setSalvando(false); }
  }

  async function arquivar() {
    if (!editando) return;
    if (!confirm(`Arquivar "${cliente!.nome}"?\n\nAs vendas dele continuam no histórico.`)) return;
    setSalvando(true);
    try { await api.negocios.clientes.arquivar(cliente!.id); onSalvo(); }
    catch (e: any) { setErro(e?.message || 'Não consegui arquivar.'); setSalvando(false); }
  }

  if (!montado) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
         onClick={() => !salvando && onClose()}>
      <div className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl border border-border/60 shadow-2xl max-h-[92vh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-base font-bold text-foreground">
            {editando ? 'Editar cliente' : 'Novo cliente'}
          </h2>
          <button onClick={() => !salvando && onClose()} aria-label="Fechar"
                  className="w-11 h-11 -mr-2 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {erro && (
            <p className="flex items-start gap-2 text-sm text-red-500 bg-red-500/10 rounded-xl p-3">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" /> {erro}
            </p>
          )}

          <div>
            <label htmlFor="cl-nome" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Nome</label>
            <input id="cl-nome" value={nome} onChange={e => setNome(e.target.value)} autoFocus
                   placeholder="Ex.: Maria Souza" className="input w-full" style={{ minHeight: 44 }} />
          </div>

          <div>
            <label htmlFor="cl-fone" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              WhatsApp
            </label>
            <input id="cl-fone" type="tel" inputMode="numeric" autoComplete="tel"
                   value={telefone} onChange={e => setTelefone(mascara(e.target.value))}
                   placeholder="(00) 00000-0000" className="input w-full tabular-nums" style={{ minHeight: 44 }} />
            <p className="text-[11px] text-muted-foreground mt-1">
              Com o número, a Sora cobra por você quando a conta vencer.
            </p>
          </div>

          <details className="group">
            <summary className="text-xs font-semibold text-muted-foreground cursor-pointer list-none inline-flex items-center gap-1.5"
                     style={{ minHeight: 32 }}>
              <span className="transition-transform group-open:rotate-90">›</span> Mais detalhes
            </summary>
            <div className="space-y-4 pt-3">
              <div>
                <label htmlFor="cl-email" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">E-mail</label>
                <input id="cl-email" type="email" inputMode="email" autoComplete="email"
                       value={email} onChange={e => setEmail(e.target.value)}
                       placeholder="opcional" className="input w-full" style={{ minHeight: 44 }} />
              </div>
              <div>
                <label htmlFor="cl-doc" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">CPF / CNPJ</label>
                <input id="cl-doc" inputMode="numeric" value={documento} onChange={e => setDocumento(e.target.value)}
                       placeholder="opcional" className="input w-full tabular-nums" style={{ minHeight: 44 }} />
              </div>
              <div>
                <label htmlFor="cl-end" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Endereço</label>
                <input id="cl-end" value={endereco} onChange={e => setEndereco(e.target.value)}
                       placeholder="opcional" className="input w-full" style={{ minHeight: 44 }} />
              </div>
              <div>
                <label htmlFor="cl-obs" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Observações</label>
                <textarea id="cl-obs" value={observacao} onChange={e => setObs(e.target.value)} rows={3}
                          placeholder="Ex.: prefere entrega às terças" className="input w-full resize-none" />
              </div>
            </div>
          </details>
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t border-border sticky bottom-0 bg-card">
          {editando && (
            <button onClick={arquivar} disabled={salvando} aria-label="Arquivar cliente"
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors flex-shrink-0"
                    style={{ minHeight: 44 }}>
              <Trash2 size={17} />
            </button>
          )}
          <button onClick={salvar} disabled={salvando}
                  className="flex-1 h-11 rounded-2xl text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: cor, minHeight: 44 }}>
            {salvando ? <Loader2 size={16} className="animate-spin" /> : <Check size={17} />}
            {editando ? 'Salvar' : 'Cadastrar'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
