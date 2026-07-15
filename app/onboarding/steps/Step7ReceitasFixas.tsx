'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Plus, Trash2, Loader2, Landmark, AlertCircle, CircleDashed } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import StepNav from '../components/StepNav';

const BRAND = 'hsl(var(--primary))';

type Receita = {
  descricao: string;
  valor:     string;
  dia:       string;
  carteira:  string;
  jaRecebeu: boolean;
  variavel:  boolean;
};

export default function Step7ReceitasFixas() {
  const { phone } = useAuth();

  const [wallets, setWallets]   = useState<any[]>([]);
  const [carregando, setCarreg] = useState(true);
  const [receitas, setReceitas] = useState<Receita[]>([
    { descricao: 'Salário', valor: '', dia: '5', carteira: '', jaRecebeu: false, variavel: false },
  ]);

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
  // Receita NÃO cai em cartão de crédito — só contas
  const opcoesConta = wallets.filter((w) => w.tipo !== 'Crédito').map((w) => w.nome);

  function atualizar(i: number, patch: Partial<Receita>) {
    setReceitas(receitas.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function adicionar() {
    setReceitas([...receitas, { descricao: '', valor: '', dia: '5', carteira: opcoesConta[0] || 'Dinheiro', jaRecebeu: false, variavel: false }]);
  }
  function remover(i: number) {
    if (receitas.length === 1) return;
    setReceitas(receitas.filter((_, idx) => idx !== i));
  }

  async function salvar() {
    if (!phone || !liberado) return;
    try {
      const num = (v: string) => parseFloat(String(v).replace(',', '.'));
      // Fixa exige valor; variável não (o valor é só estimativa opcional).
      const validos = receitas.filter((r) => r.descricao.trim() && (r.variavel || num(r.valor) > 0));
      if (validos.length === 0) return;
      const hoje = new Date().toISOString().slice(0, 10);
      await Promise.all(validos.map(async (r) => {
        const v = num(r.valor);
        const valor = isNaN(v) || v <= 0 ? 0 : v;
        const carteira = r.carteira || opcoesConta[0] || 'Dinheiro';
        await api.recorrencias.criar({
          phone, tipo: 'Recebimento',
          descricao: r.descricao.trim(), valor,
          dia_vencimento: Math.max(1, Math.min(31, parseInt(r.dia) || 5)),
          carteira,
          valor_variavel: r.variavel,
        });
        // "Já recebi" só faz sentido com valor conhecido (> 0).
        if (r.jaRecebeu && valor > 0) {
          await api.transacoes.criar({
            phone, tipo: 'Recebimento', valor, data: hoje,
            observacao: r.descricao.trim(), categoria: '💼 Salário',
            carteira_nome: carteira, pago: true,
          });
        }
      }));
    } catch (e) {
      console.warn('[onboarding] erro ao salvar receitas', e);
    }
  }

  const temAlgum = receitas.some((r) => r.descricao.trim() && (r.variavel || parseFloat(String(r.valor).replace(',', '.')) > 0));

  return (
    <>
      <div className="space-y-3 mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-2" style={{ background: `color-mix(in srgb, ${BRAND} 10%, transparent)` }}>
          <TrendingUp size={20} style={{ color: BRAND }} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight">
          Receitas fixas mensais
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
          Salário e aluguéis (valor fixo) ou freela, comissão, vendas (valor que muda). Coisas que entram todo mês.
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
              Pra cadastrar receitas fixas você precisa de pelo menos uma <strong>conta bancária</strong> e um <strong>cartão de crédito</strong>. Volte ao passo de contas e adicione.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {receitas.map((r, i) => (
            <div key={i} className="p-4 rounded-2xl border border-border bg-card">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Receita {i + 1}</p>
                {receitas.length > 1 && (
                  <button type="button" onClick={() => remover(i)} className="text-red-500 hover:text-red-600"><Trash2 size={14} /></button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_130px_92px] gap-3 mb-3">
                <input type="text" value={r.descricao} onChange={(e) => atualizar(i, { descricao: e.target.value })} placeholder="Ex.: Salário, Freela"
                  className="px-3 py-2.5 rounded-xl bg-background border border-border text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary" />
                <input type="text" inputMode="decimal" value={r.valor} onChange={(e) => atualizar(i, { valor: e.target.value })}
                  placeholder={r.variavel ? 'Estimativa' : 'R$ 0,00'}
                  aria-label={r.variavel ? 'Valor estimado (opcional)' : 'Valor'}
                  className="px-3 py-2.5 rounded-xl bg-background border border-border text-sm tabular-nums placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary" />
                <div className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-background border border-border text-sm">
                  <span className="text-muted-foreground text-xs">Dia</span>
                  <input type="text" inputMode="numeric" value={r.dia} onChange={(e) => atualizar(i, { dia: e.target.value })} className="w-full bg-transparent focus:outline-none tabular-nums" />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <Landmark size={14} className="text-muted-foreground flex-shrink-0" />
                  <select value={r.carteira || opcoesConta[0]} onChange={(e) => atualizar(i, { carteira: e.target.value })}
                    className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-background border border-border text-sm focus:outline-none focus:border-primary">
                    {opcoesConta.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input type="checkbox" checked={r.jaRecebeu} onChange={(e) => atualizar(i, { jaRecebeu: e.target.checked })} className="w-4 h-4 accent-primary cursor-pointer" />
                  <span className="text-xs text-foreground">Já recebi este mês</span>
                </label>
              </div>

              {/* Toggle fixo/varia */}
              <div className="mt-3 flex justify-end">
                <div className="inline-flex p-1 rounded-xl bg-muted/60" role="group" aria-label="Tipo de valor">
                  <button type="button" role="switch" aria-checked={!r.variavel} onClick={() => atualizar(i, { variavel: false })}
                    className={`px-3 h-9 rounded-lg text-xs font-bold transition-all ${!r.variavel ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                    Valor fixo
                  </button>
                  <button type="button" role="switch" aria-checked={r.variavel} onClick={() => atualizar(i, { variavel: true })}
                    className={`px-3 h-9 rounded-lg text-xs font-bold transition-all ${r.variavel ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                    Valor varia
                  </button>
                </div>
              </div>

              {r.variavel && (
                <p className="text-[11px] text-muted-foreground mt-2.5 flex items-start gap-1.5 leading-relaxed">
                  <CircleDashed size={13} className="mt-0.5 flex-shrink-0 text-amber-600" />
                  Todo dia {r.dia || 'X'} a Sora te lembra e você confirma o valor real — a estimativa acima é só pra referência.
                </p>
              )}
            </div>
          ))}

          <button type="button" onClick={adicionar}
            className="w-full p-4 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2">
            <Plus size={16} /> Adicionar outra receita
          </button>
        </div>
      )}

      <StepNav podeAvancar={true} onAntesAvancar={liberado && temAlgum ? salvar : undefined} />
    </>
  );
}
