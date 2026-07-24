'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Loader2, Trash2, Pencil, Check, Wallet, Landmark, CreditCard, Coins } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { fmtCent, type ContaNegocio, type TipoContaNegocio } from '@/lib/lancamentos';

const TIPOS: { v: TipoContaNegocio; label: string; Icon: typeof Wallet }[] = [
  { v: 'dinheiro', label: 'Dinheiro',  Icon: Coins },
  { v: 'banco',    label: 'Banco',     Icon: Landmark },
  { v: 'cartao',   label: 'Maquininha/Cartão', Icon: CreditCard },
  { v: 'outro',    label: 'Outra',     Icon: Wallet },
];
export const iconeConta = (t?: string) => (TIPOS.find(x => x.v === t)?.Icon || Wallet);

// Gerencia as CONTAS (caixas) de uma empresa: dinheiro, banco digital,
// maquininha… Cada lançamento do caixa aponta pra uma dessas. Portal pro body
// (os cards do painel usam backdrop-blur → prende o fixed). Migration 095.
export default function ModalContas({
  empresaId, cor, onClose, onChanged,
}: {
  empresaId: string;
  cor: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { phone } = useAuth();
  const [contas, setContas] = useState<ContaNegocio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Form (criar/editar)
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoContaNegocio>('dinheiro');
  const [saldoRaw, setSaldoRaw] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => { setMounted(true); }, []);

  async function carregar() {
    if (!phone) return;
    try {
      const cs = await api.negocios.contas.listar(phone, empresaId);
      setContas(cs || []);
    } catch { setContas([]); }
    finally { setCarregando(false); }
  }
  useEffect(() => { carregar(); /* eslint-disable-line */ }, [phone, empresaId]);

  function limpar() { setEditId(null); setNome(''); setTipo('dinheiro'); setSaldoRaw(''); setErro(''); }
  function editar(c: ContaNegocio) {
    setEditId(c.id); setNome(c.nome); setTipo(c.tipo || 'dinheiro');
    setSaldoRaw(c.saldo_inicial ? String(c.saldo_inicial) : ''); setErro('');
  }

  async function salvar() {
    if (!nome.trim()) { setErro('Dê um nome pra conta.'); return; }
    setSalvando(true); setErro('');
    try {
      const saldo_inicial = parseInt(saldoRaw || '0', 10) || 0;
      if (editId) await api.negocios.contas.editar(editId, { nome: nome.trim(), tipo, saldo_inicial });
      else        await api.negocios.contas.criar({ empresa_id: empresaId, nome: nome.trim(), tipo, saldo_inicial });
      limpar();
      await carregar();
      onChanged?.();
    } catch (e: any) { setErro(e?.message || 'Não consegui salvar.'); }
    finally { setSalvando(false); }
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta conta? Os lançamentos ligados a ela ficam sem conta.')) return;
    try { await api.negocios.contas.arquivar(id); await carregar(); onChanged?.(); } catch { /* noop */ }
  }

  if (!mounted) return null;

  return createPortal((
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
         onClick={onClose}>
      <div className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl border border-border/60 shadow-2xl max-h-[92dvh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="text-base font-bold text-foreground">Contas do negócio</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Onde o dinheiro entra e sai (dinheiro, banco, maquininha)</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="w-11 h-11 -mr-2 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Lista */}
          {carregando ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando…</p>
          ) : contas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">Nenhuma conta ainda. Crie a primeira abaixo (ex.: Dinheiro, Nubank PJ, Maquininha).</p>
          ) : (
            <div className="space-y-2">
              {contas.map(c => {
                const Icon = iconeConta(c.tipo);
                return (
                  <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-border/60 bg-muted/20">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted text-muted-foreground">
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{c.nome}</p>
                      {!!c.saldo_inicial && <p className="text-[11px] text-muted-foreground">Abertura: {fmtCent(c.saldo_inicial)}</p>}
                    </div>
                    <button onClick={() => editar(c)} aria-label="Editar" className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><Pencil size={14} /></button>
                    <button onClick={() => excluir(c.id)} aria-label="Excluir" className="w-9 h-9 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 size={14} /></button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Form criar/editar */}
          <div className="rounded-2xl border border-border/60 p-3.5 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{editId ? 'Editar conta' : 'Nova conta'}</p>
            <input value={nome} onChange={e => setNome(e.target.value)} maxLength={40}
                   placeholder="Nome (ex.: Dinheiro, Nubank PJ, Maquininha)" className="input w-full" />
            <div className="flex flex-wrap gap-1.5">
              {TIPOS.map(t => {
                const on = tipo === t.v;
                return (
                  <button key={t.v} onClick={() => setTipo(t.v)} aria-pressed={on}
                          className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-xs font-semibold border transition-colors"
                          style={{ borderColor: on ? cor : 'hsl(var(--border) / 0.6)', background: on ? `color-mix(in srgb, ${cor} 12%, transparent)` : 'transparent', color: on ? cor : 'hsl(var(--foreground))' }}>
                    <t.Icon size={13} /> {t.label}
                  </button>
                );
              })}
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Saldo de abertura (opcional)</label>
              <div className="flex items-baseline gap-1 input">
                <span className="text-sm font-bold text-muted-foreground">R$</span>
                <input inputMode="numeric" value={saldoRaw ? (parseInt(saldoRaw, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                       onChange={e => setSaldoRaw(e.target.value.replace(/\D/g, ''))}
                       placeholder="0,00" className="bg-transparent border-none outline-none w-full tabular font-semibold" />
              </div>
            </div>
            {erro && <p className="text-xs text-red-600">{erro}</p>}
            <div className="flex items-center gap-2">
              {editId && <button onClick={limpar} className="btn-ghost px-3 h-10 text-sm">Cancelar</button>}
              <div className="flex-1" />
              <button onClick={salvar} disabled={salvando}
                      className="inline-flex items-center gap-2 px-4 h-10 rounded-xl text-white text-sm font-bold disabled:opacity-60"
                      style={{ background: cor }}>
                {salvando ? <Loader2 size={14} className="animate-spin" /> : editId ? <Check size={14} /> : <Plus size={14} />}
                {editId ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  ), document.body);
}
