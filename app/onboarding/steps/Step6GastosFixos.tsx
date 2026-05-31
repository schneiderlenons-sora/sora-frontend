'use client';

import { useEffect, useRef, useState } from 'react';
import { Receipt, Plus, Trash2, Loader2, Landmark, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { PLANOS_INFO, type PlanoId } from '@/lib/stripe';
import { PLANO_LABEL } from '@/lib/plans';
import StepNav from '../components/StepNav';

const BRAND = '#61D17B';

type Gasto = {
  descricao: string;
  valor:     string;
  dia:       string;
  carteira:  string;
};

export default function Step6GastosFixos() {
  const { perfil, phone } = useAuth();

  const [wallets, setWallets]   = useState<any[]>([]);
  const [carregando, setCarreg] = useState(true);
  const [gastos, setGastos]     = useState<Gasto[]>([
    { descricao: '', valor: '', dia: '5', carteira: '' },
  ]);

  // Carrega as contas/cartões pra liberar o passo e popular o seletor.
  useEffect(() => {
    if (!phone) { setCarreg(false); return; }
    let vivo = true;
    (async () => {
      try { const w = await api.wallets.listar(phone); if (vivo) setWallets(w || []); }
      catch { if (vivo) setWallets([]); }
      finally { if (vivo) setCarreg(false); }
    })();
    return () => { vivo = false; };
  }, [phone]);

  const temBanco  = wallets.some((w) => w.tipo !== 'Crédito');
  const temCartao = wallets.some((w) => w.tipo === 'Crédito');
  const liberado  = temBanco && temCartao;
  // Gasto fixo pode sair de conta OU cartão
  const opcoesConta = wallets.map((w) => w.nome);

  // Pré-preenche a assinatura da Sora (só plano mensal). Roda quando libera.
  const jaPreencheu = useRef(false);
  useEffect(() => {
    if (jaPreencheu.current || !perfil || !liberado) return;
    const plano = perfil.plano;
    if (plano === 'inativo' || perfil.plano_intervalo !== 'mensal') return;
    const preco = PLANOS_INFO[plano as PlanoId]?.mensal;
    if (!preco) return;
    jaPreencheu.current = true;
    const dia = String(Math.min(28, Math.max(1, new Date().getDate())));
    setGastos((g) =>
      g.length === 1 && !g[0].descricao && !g[0].valor
        ? [{ descricao: `Assinatura Sora ${PLANO_LABEL[plano]}`, valor: preco.toFixed(2).replace('.', ','), dia, carteira: opcoesConta[0] || 'Dinheiro' }]
        : g,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil, liberado]);

  function atualizar(i: number, patch: Partial<Gasto>) {
    setGastos(gastos.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  }
  function adicionar() {
    setGastos([...gastos, { descricao: '', valor: '', dia: '5', carteira: opcoesConta[0] || 'Dinheiro' }]);
  }
  function remover(i: number) {
    if (gastos.length === 1) return;
    setGastos(gastos.filter((_, idx) => idx !== i));
  }

  async function salvar() {
    if (!phone || !liberado) return;
    try {
      const validos = gastos.filter((g) => g.descricao.trim() && parseFloat(g.valor) > 0);
      if (validos.length === 0) return;
      await Promise.all(validos.map((g) =>
        api.recorrencias.criar({
          phone, tipo: 'Gasto',
          descricao: g.descricao.trim(),
          valor: parseFloat(String(g.valor).replace(',', '.')),
          dia_vencimento: Math.max(1, Math.min(28, parseInt(g.dia) || 5)),
          carteira: g.carteira || opcoesConta[0] || 'Dinheiro',
        }),
      ));
    } catch (e) {
      console.warn('[onboarding] erro ao salvar gastos fixos', e);
    }
  }

  const temAlgum = gastos.some((g) => g.descricao.trim() && parseFloat(g.valor) > 0);

  return (
    <>
      <div className="space-y-3 mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-2" style={{ background: `${BRAND}1A` }}>
          <Receipt size={20} style={{ color: BRAND }} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight">
          Gastos fixos mensais
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
          Aluguel, internet, academia, assinaturas. Coisas que se repetem todo mês.
        </p>
      </div>

      {carregando ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 size={16} className="animate-spin" /> Carregando…
        </div>
      ) : !liberado ? (
        <div className="p-5 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-foreground">Adicione contas primeiro</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Pra cadastrar gastos fixos você precisa de pelo menos uma <strong>conta bancária</strong> e um <strong>cartão de crédito</strong>. Volte ao passo anterior e adicione — depois é só voltar aqui.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {gastos.map((g, i) => (
            <div key={i} className="p-4 rounded-2xl border border-border bg-card">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Gasto {i + 1}</p>
                {gastos.length > 1 && (
                  <button type="button" onClick={() => remover(i)} className="text-red-500 hover:text-red-600"><Trash2 size={14} /></button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_130px_92px] gap-3 mb-3">
                <input type="text" value={g.descricao} onChange={(e) => atualizar(i, { descricao: e.target.value })} placeholder="Ex.: Aluguel, Netflix"
                  className="px-3 py-2.5 rounded-xl bg-background border border-border text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary" />
                <input type="text" inputMode="decimal" value={g.valor} onChange={(e) => atualizar(i, { valor: e.target.value })} placeholder="R$ 0,00"
                  className="px-3 py-2.5 rounded-xl bg-background border border-border text-sm tabular-nums placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary" />
                <div className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-background border border-border text-sm">
                  <span className="text-muted-foreground text-xs">Dia</span>
                  <input type="text" inputMode="numeric" value={g.dia} onChange={(e) => atualizar(i, { dia: e.target.value })} className="w-full bg-transparent focus:outline-none tabular-nums" />
                </div>
              </div>

              {/* Seletor de conta/cartão */}
              <div className="flex items-center gap-2">
                <Landmark size={14} className="text-muted-foreground flex-shrink-0" />
                <select value={g.carteira || opcoesConta[0]} onChange={(e) => atualizar(i, { carteira: e.target.value })}
                  className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-background border border-border text-sm focus:outline-none focus:border-primary">
                  {opcoesConta.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
                </select>
              </div>
            </div>
          ))}

          <button type="button" onClick={adicionar}
            className="w-full p-4 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2">
            <Plus size={16} /> Adicionar outro gasto fixo
          </button>

          <p className="text-xs text-muted-foreground mt-2 text-center">Pode pular esse passo se ainda não tem nada. Adiciona depois pelo painel.</p>
        </div>
      )}

      <StepNav podeAvancar={true} onAntesAvancar={liberado && temAlgum ? salvar : undefined} />
    </>
  );
}
