'use client';

import { useState } from 'react';
import { Landmark, Plus, Trash2, Upload, Crown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import StepNav from '../components/StepNav';

const BRAND = '#61D17B';

type TipoConta = 'Corrente' | 'Poupança' | 'Dinheiro' | 'Crédito';
const TIPOS: TipoConta[] = ['Corrente', 'Poupança', 'Dinheiro', 'Crédito'];

type Conta = {
  nome:  string;
  tipo:  TipoConta;
  saldo: string;
};

export default function Step5Contas() {
  const { perfil, podeUsar } = useAuth();
  const [contas, setContas] = useState<Conta[]>([
    { nome: 'Carteira', tipo: 'Dinheiro', saldo: '' },
  ]);

  function atualizar(i: number, patch: Partial<Conta>) {
    setContas(contas.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function adicionar() {
    setContas([...contas, { nome: '', tipo: 'Corrente', saldo: '' }]);
  }
  function remover(i: number) {
    if (contas.length === 1) return;
    setContas(contas.filter((_, idx) => idx !== i));
  }

  async function salvar() {
    const grupoId = perfil?.grupo_ativo?.id;
    if (!grupoId) return;
    try {
      const rows = contas
        .filter((c) => c.nome.trim())
        .map((c) => ({
          grupo_id: grupoId,
          nome:     c.nome.trim(),
          tipo:     c.tipo,
          saldo:    parseFloat(String(c.saldo || '0').replace(',', '.')) || 0,
          arquivada: false,
        }));
      if (rows.length > 0) {
        await supabase.from('wallets').insert(rows);
      }
    } catch (e) {
      console.warn('[onboarding] erro ao salvar contas', e);
    }
  }

  const podeOFX = podeUsar('import_ofx');
  const valido = contas.some((c) => c.nome.trim());

  return (
    <>
      <div className="space-y-3 mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-2"
             style={{ background: `${BRAND}1A` }}>
          <Landmark size={20} style={{ color: BRAND }} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight">
          Suas contas
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
          Cadastre conta corrente, poupança ou dinheiro. Você pode adicionar mais depois.
        </p>
      </div>

      {/* OFX Premium banner */}
      {podeOFX ? (
        <div className="mb-5 p-4 rounded-2xl border border-primary/30 bg-primary/5 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{ background: BRAND }}>
            <Upload size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">Tem extrato bancário em OFX?</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Importe e a Sora categoriza 30 dias de transações automaticamente.
            </p>
            <a href="/transacoes" className="inline-block mt-2 text-xs font-bold text-primary hover:underline">
              Importar extrato →
            </a>
          </div>
        </div>
      ) : (
        <div className="mb-5 p-4 rounded-2xl border border-border bg-card/60 flex items-start gap-3 opacity-80">
          <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
            <Crown size={16} className="text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">Importação OFX</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Suba seu extrato e a IA categoriza 30 dias automaticamente. Disponível no Premium.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {contas.map((c, i) => (
          <div key={i} className="p-4 rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Conta {i + 1}
              </p>
              {contas.length > 1 && (
                <button
                  type="button"
                  onClick={() => remover(i)}
                  className="text-red-500 hover:text-red-600 transition-colors"
                  aria-label="Remover conta"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_140px] gap-3">
              <input
                type="text"
                value={c.nome}
                onChange={(e) => atualizar(i, { nome: e.target.value })}
                placeholder="Nome (ex.: Nubank, Carteira)"
                className="px-3 py-2.5 rounded-xl bg-background border border-border text-sm
                           placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
              />
              <select
                value={c.tipo}
                onChange={(e) => atualizar(i, { tipo: e.target.value as TipoConta })}
                className="px-3 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:border-primary"
              >
                {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input
                type="text"
                inputMode="decimal"
                value={c.saldo}
                onChange={(e) => atualizar(i, { saldo: e.target.value })}
                placeholder="Saldo R$ 0,00"
                className="px-3 py-2.5 rounded-xl bg-background border border-border text-sm tabular-nums
                           placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={adicionar}
          className="w-full p-4 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5
                     text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors
                     flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          Adicionar outra conta
        </button>
      </div>

      <StepNav podeAvancar={valido} onAntesAvancar={salvar} />
    </>
  );
}
