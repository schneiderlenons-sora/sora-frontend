'use client';

import { useState } from 'react';
import { TrendingUp, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import StepNav from '../components/StepNav';

const BRAND = '#61D17B';

type Receita = {
  descricao:    string;
  valor:        string;
  dia:          string;
  jaRecebeu:    boolean;
};

export default function Step7ReceitasFixas() {
  const { perfil } = useAuth();
  const [receitas, setReceitas] = useState<Receita[]>([
    { descricao: 'Salário', valor: '', dia: '5', jaRecebeu: false },
  ]);

  function atualizar(i: number, patch: Partial<Receita>) {
    setReceitas(receitas.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function adicionar() {
    setReceitas([...receitas, { descricao: '', valor: '', dia: '5', jaRecebeu: false }]);
  }
  function remover(i: number) {
    if (receitas.length === 1) return;
    setReceitas(receitas.filter((_, idx) => idx !== i));
  }

  async function salvar() {
    const grupoId = perfil?.grupo_ativo?.id;
    const userId  = perfil?.id;
    if (!grupoId || !userId) return;

    try {
      const validos = receitas.filter((r) => r.descricao.trim() && parseFloat(r.valor) > 0);
      if (validos.length === 0) return;

      const hoje = new Date();

      // Recorrência de RECEBIMENTO (sempre cria) — mesma tabela `recorrencias`
      // que o job mensal lê pra lançar a receita automaticamente todo mês.
      const recRows = validos.map((r) => ({
        grupo_id:       grupoId,
        tipo:           'Recebimento',
        categoria:      '💼 Salário',   // dedup do job casa por categoria — precisa ser não-nula
        descricao:      r.descricao.trim(),
        valor:          parseFloat(String(r.valor).replace(',', '.')),
        dia_vencimento: Math.max(1, Math.min(28, parseInt(r.dia) || 5)),
        carteira:       'Dinheiro',
        ativa:          true,
      }));
      await supabase.from('recorrencias').insert(recRows);

      // Se "já recebeu" → cria transação real do mês atual
      const txRows = validos
        .filter((r) => r.jaRecebeu)
        .map((r) => ({
          grupo_id:   grupoId,
          criado_por: userId,
          tipo:       'Recebimento',
          valor:      parseFloat(String(r.valor).replace(',', '.')),
          data:       hoje.toISOString().slice(0, 10),
          observacao: r.descricao.trim(),
          categoria:  '💼 Salário',
          pago:       true,
        }));
      if (txRows.length > 0) {
        await supabase.from('transacoes').insert(txRows);
      }
    } catch (e) {
      console.warn('[onboarding] erro ao salvar receitas', e);
    }
  }

  const temAlgum = receitas.some((r) => r.descricao.trim() && parseFloat(r.valor) > 0);

  return (
    <>
      <div className="space-y-3 mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-2"
             style={{ background: `${BRAND}1A` }}>
          <TrendingUp size={20} style={{ color: BRAND }} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight">
          Receitas fixas mensais
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
          Salário, freelas regulares, aluguéis recebidos. Coisas que entram todo mês.
        </p>
      </div>

      <div className="space-y-3">
        {receitas.map((r, i) => (
          <div key={i} className="p-4 rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Receita {i + 1}
              </p>
              {receitas.length > 1 && (
                <button type="button" onClick={() => remover(i)} className="text-red-500 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_100px] gap-3 mb-3">
              <input
                type="text"
                value={r.descricao}
                onChange={(e) => atualizar(i, { descricao: e.target.value })}
                placeholder="Ex.: Salário, Freela"
                className="px-3 py-2.5 rounded-xl bg-background border border-border text-sm
                           placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
              />
              <input
                type="text"
                inputMode="decimal"
                value={r.valor}
                onChange={(e) => atualizar(i, { valor: e.target.value })}
                placeholder="R$ 0,00"
                className="px-3 py-2.5 rounded-xl bg-background border border-border text-sm tabular-nums
                           placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
              />
              <div className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-background border border-border text-sm">
                <span className="text-muted-foreground text-xs">Dia</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={r.dia}
                  onChange={(e) => atualizar(i, { dia: e.target.value })}
                  className="w-full bg-transparent focus:outline-none tabular-nums"
                />
              </div>
            </div>

            {/* Toggle "já recebeu este mês" */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={r.jaRecebeu}
                onChange={(e) => atualizar(i, { jaRecebeu: e.target.checked })}
                className="w-4 h-4 accent-primary cursor-pointer"
              />
              <span className="text-xs text-foreground">Já recebi este mês</span>
            </label>
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
          Adicionar outra receita
        </button>
      </div>

      <StepNav podeAvancar={true} onAntesAvancar={temAlgum ? salvar : undefined} />
    </>
  );
}
