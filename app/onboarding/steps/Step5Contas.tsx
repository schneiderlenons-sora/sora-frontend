'use client';

import { useCallback, useEffect, useState } from 'react';
import { Landmark, Plus, Trash2, Loader2, CreditCard, Check, X, Wallet } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import AdicionarCartaoModal, { bancoLogo } from '@/components/cartoes/AdicionarCartaoModal';
import StepNav from '../components/StepNav';

const BRAND = '#61D17B';
const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

type TipoBanco = 'Corrente' | 'Poupança' | 'Dinheiro';
const TIPOS_BANCO: TipoBanco[] = ['Corrente', 'Poupança', 'Dinheiro'];

export default function Step5Contas() {
  const { phone } = useAuth();

  const [wallets, setWallets]   = useState<any[]>([]);
  const [carregando, setCarreg] = useState(true);
  const [addOpen, setAddOpen]   = useState(false);
  const [cartaoOpen, setCartaoOpen] = useState(false);

  // form de conta bancária
  const [nome, setNome]   = useState('');
  const [tipo, setTipo]   = useState<TipoBanco>('Corrente');
  const [saldo, setSaldo] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!phone) { setCarreg(false); return; }
    try { setWallets((await api.wallets.listar(phone)) || []); }
    catch { setWallets([]); }
    finally { setCarreg(false); }
  }, [phone]);
  useEffect(() => { carregar(); }, [carregar]);

  const contas  = wallets.filter((w) => w.tipo !== 'Crédito');
  const cartoes = wallets.filter((w) => w.tipo === 'Crédito');

  async function addConta() {
    if (!nome.trim() || !phone) return;
    setSalvando(true);
    try {
      await api.wallets.salvar({
        phone, nome: nome.trim(), tipo,
        saldo: parseFloat(String(saldo || '0').replace(',', '.')) || 0,
      });
      setNome(''); setSaldo(''); setTipo('Corrente'); setAddOpen(false);
      await carregar();
    } catch { /* noop */ } finally { setSalvando(false); }
  }

  async function remover(id: string) {
    setWallets((prev) => prev.filter((w) => w.id !== id)); // otimista
    try { await api.wallets.deletar(id); } catch { carregar(); }
  }

  return (
    <>
      <div className="space-y-3 mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-2" style={{ background: `${BRAND}1A` }}>
          <Landmark size={20} style={{ color: BRAND }} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight">
          Suas contas e cartões
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
          Cadastre suas contas bancárias e cartões de crédito. É com elas que a Sora organiza suas finanças.
        </p>
      </div>

      {carregando ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 size={16} className="animate-spin" /> Carregando…
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── CONTAS BANCÁRIAS ─────────────────────────────── */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Contas bancárias</h2>
              {!addOpen && (
                <button
                  onClick={() => setAddOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5"
                  style={{ background: `${BRAND}1A`, color: BRAND }}
                >
                  <Plus size={14} /> Adicionar
                </button>
              )}
            </div>

            {contas.map((c) => {
              const logo = bancoLogo(c.nome);
              return (
                <div key={c.id} className="group flex items-center gap-3 p-3 rounded-2xl border border-border bg-card">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: logo.bg }}>
                    {logo.text}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{c.nome}</p>
                    <p className="text-[11px] text-muted-foreground">{c.tipo}</p>
                  </div>
                  <span className="text-sm font-bold text-foreground tabular-nums">{fmt(c.saldo)}</span>
                  <button onClick={() => remover(c.id)} className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100" aria-label={`Remover ${c.nome}`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}

            {/* Form inline de nova conta */}
            {addOpen && (
              <div className="p-4 rounded-2xl border border-border bg-muted/20 animate-fade-in space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_130px_130px] gap-2.5">
                  <input
                    autoFocus
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addConta()}
                    placeholder="Nome (ex.: Nubank)"
                    className="px-3.5 h-11 rounded-xl bg-background border border-border text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
                  />
                  <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoBanco)} className="px-3 h-11 rounded-xl bg-background border border-border text-sm focus:outline-none focus:border-primary">
                    {TIPOS_BANCO.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input
                    inputMode="decimal"
                    value={saldo}
                    onChange={(e) => setSaldo(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addConta()}
                    placeholder="Saldo R$ 0,00"
                    className="px-3.5 h-11 rounded-xl bg-background border border-border text-sm tabular-nums placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={addConta} disabled={!nome.trim() || salvando} className="inline-flex items-center gap-1.5 px-4 h-11 rounded-xl text-sm font-bold text-white shadow-sm disabled:opacity-40" style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}>
                    {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Salvar conta
                  </button>
                  <button onClick={() => { setAddOpen(false); setNome(''); setSaldo(''); }} className="px-4 h-11 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {contas.length === 0 && !addOpen && (
              <button onClick={() => setAddOpen(true)} className="w-full p-4 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2">
                <Wallet size={16} /> Adicionar conta bancária
              </button>
            )}
          </section>

          {/* ── CARTÕES DE CRÉDITO ───────────────────────────── */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Cartões de crédito</h2>
              {contas.length > 0 && (
                <button
                  onClick={() => setCartaoOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5"
                  style={{ background: `${BRAND}1A`, color: BRAND }}
                >
                  <Plus size={14} /> Adicionar
                </button>
              )}
            </div>

            {cartoes.map((c) => {
              const logo = bancoLogo(c.nome);
              return (
                <div key={c.id} className="group flex items-center gap-3 p-3 rounded-2xl border border-border bg-card">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: logo.bg }}>
                    {logo.text}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{c.nome}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Crédito{c.limite ? ` · limite ${fmt(c.limite)}` : ''}
                    </p>
                  </div>
                  <button onClick={() => remover(c.id)} className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100" aria-label={`Remover ${c.nome}`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}

            {contas.length === 0 ? (
              <div className="p-4 rounded-2xl border border-border bg-card/60 text-xs text-muted-foreground leading-relaxed">
                Cadastre uma conta bancária primeiro — o cartão é vinculado a uma conta.
              </div>
            ) : cartoes.length === 0 && (
              <button onClick={() => setCartaoOpen(true)} className="w-full p-4 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2">
                <CreditCard size={16} /> Adicionar cartão de crédito
              </button>
            )}
          </section>
        </div>
      )}

      <StepNav podeAvancar={!carregando} />

      {cartaoOpen && (
        <AdicionarCartaoModal
          phone={phone || ''}
          onClose={() => setCartaoOpen(false)}
          onSuccess={() => { setCartaoOpen(false); carregar(); }}
        />
      )}
    </>
  );
}
