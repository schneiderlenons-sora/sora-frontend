'use client';

import { useEffect, useRef, useState } from 'react';
import { Receipt, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PLANOS_INFO, type PlanoId } from '@/lib/stripe';
import { PLANO_LABEL } from '@/lib/plans';
import StepNav from '../components/StepNav';

const BRAND = '#61D17B';

type Gasto = {
  descricao:   string;
  valor:       string;
  dia:         string;
};

export default function Step6GastosFixos() {
  const { perfil } = useAuth();
  const [gastos, setGastos] = useState<Gasto[]>([
    { descricao: '', valor: '', dia: '5' },
  ]);

  // Pré-preenche a assinatura da Sora como gasto fixo — SÓ se o plano for
  // mensal (no anual é uma cobrança única, não recorrente: aí a Sora pergunta
  // depois como foi o pagamento). Roda uma vez, quando o perfil carrega.
  const jaPreencheu = useRef(false);
  useEffect(() => {
    if (jaPreencheu.current || !perfil) return;
    const plano = perfil.plano;
    if (plano === 'inativo' || perfil.plano_intervalo !== 'mensal') return;
    const preco = PLANOS_INFO[plano as PlanoId]?.mensal;
    if (!preco) return;
    jaPreencheu.current = true;
    const dia = String(Math.min(28, Math.max(1, new Date().getDate())));
    setGastos((g) =>
      g.length === 1 && !g[0].descricao && !g[0].valor
        ? [{ descricao: `Assinatura Sora ${PLANO_LABEL[plano]}`, valor: preco.toFixed(2).replace('.', ','), dia }]
        : g,
    );
  }, [perfil]);

  function atualizar(i: number, patch: Partial<Gasto>) {
    setGastos(gastos.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  }
  function adicionar() {
    setGastos([...gastos, { descricao: '', valor: '', dia: '5' }]);
  }
  function remover(i: number) {
    if (gastos.length === 1) return;
    setGastos(gastos.filter((_, idx) => idx !== i));
  }

  async function salvar() {
    const grupoId = perfil?.grupo_ativo?.id;
    if (!grupoId) return;
    try {
      const validos = gastos.filter((g) => g.descricao.trim() && parseFloat(g.valor) > 0);
      if (validos.length === 0) return;

      // Grava como RECORRÊNCIA (não dívida) — é o que o job mensal lê pra
      // lançar a transação automaticamente todo mês no dia certo.
      const rows = validos.map((g) => ({
        grupo_id:       grupoId,
        tipo:           'Gasto',
        categoria:      'Outros',   // dedup do job casa por categoria — precisa ser não-nula
        descricao:      g.descricao.trim(),
        valor:          parseFloat(String(g.valor).replace(',', '.')),
        dia_vencimento: Math.max(1, Math.min(28, parseInt(g.dia) || 5)),
        carteira:       'Dinheiro',
        ativa:          true,
      }));
      await supabase.from('recorrencias').insert(rows);
    } catch (e) {
      console.warn('[onboarding] erro ao salvar gastos fixos', e);
    }
  }

  const temAlgum = gastos.some((g) => g.descricao.trim() && parseFloat(g.valor) > 0);

  return (
    <>
      <div className="space-y-3 mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-2"
             style={{ background: `${BRAND}1A` }}>
          <Receipt size={20} style={{ color: BRAND }} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight">
          Gastos fixos mensais
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
          Aluguel, internet, academia, assinaturas, anuidades. Coisas que se repetem todo mês.
        </p>
      </div>

      <div className="space-y-3">
        {gastos.map((g, i) => (
          <div key={i} className="p-4 rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Gasto {i + 1}
              </p>
              {gastos.length > 1 && (
                <button type="button" onClick={() => remover(i)} className="text-red-500 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_100px] gap-3">
              <input
                type="text"
                value={g.descricao}
                onChange={(e) => atualizar(i, { descricao: e.target.value })}
                placeholder="Ex.: Aluguel, Netflix"
                className="px-3 py-2.5 rounded-xl bg-background border border-border text-sm
                           placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
              />
              <input
                type="text"
                inputMode="decimal"
                value={g.valor}
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
                  value={g.dia}
                  onChange={(e) => atualizar(i, { dia: e.target.value })}
                  className="w-full bg-transparent focus:outline-none tabular-nums"
                />
              </div>
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
          Adicionar outro gasto fixo
        </button>
      </div>

      <p className="text-xs text-muted-foreground mt-4 text-center">
        Pode pular esse passo se ainda não tem nada. Adiciona depois pelo painel.
      </p>

      <StepNav podeAvancar={true} onAntesAvancar={temAlgum ? salvar : undefined} />
    </>
  );
}
