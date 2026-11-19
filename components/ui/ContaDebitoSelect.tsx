'use client';

import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useDinheiro } from '@/lib/moeda-base';

// Bloco opcional "Descontar do saldo de uma conta?" — usado nos fluxos de
// aporte (meta/investimento), pagamento de dívida e fatura. Quando ligado e
// com conta escolhida, o backend cria uma transação de saída e desconta o
// saldo. `onChange(null)` quando desligado ou sem conta selecionada.
//
// `modo="credito"` é o caminho inverso (resgate de meta): o valor VOLTA pra
// conta escolhida, como entrada. Só os textos mudam; a escolha é a mesma.
const TEXTOS = {
  debito:  { label: 'Descontar do saldo de uma conta?', qual: 'De qual conta', vazio: 'Nenhuma conta cadastrada pra descontar.', ajuda: 'Vai aparecer nas transações como uma saída dessa conta.' },
  credito: { label: 'Devolver o valor pra uma conta?', qual: 'Pra qual conta', vazio: 'Nenhuma conta cadastrada pra receber.', ajuda: 'Soma no saldo da conta e aparece nas transações como entrada. Não conta como receita do mês: é o seu dinheiro voltando da meta.' },
} as const;

export default function ContaDebitoSelect({
  value,
  onChange,
  excluirCredito = true,
  modo = 'debito',
  label,
}: {
  value: string | null;
  onChange: (walletId: string | null) => void;
  excluirCredito?: boolean;
  modo?: 'debito' | 'credito';
  label?: string;
}) {
  const t = TEXTOS[modo];
  const { phone } = useAuth();
  const [contas, setContas] = useState<any[]>([]);
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!phone) return;
    api.wallets.listar(phone)
      .then((ws: any[]) => setContas((ws || []).filter(w => !excluirCredito || w.tipo !== 'Crédito')))
      .catch(() => setContas([]));
  }, [phone, excluirCredito]);

  function toggle() {
    const novo = !on;
    setOn(novo);
    if (!novo) onChange(null);
    else if (contas.length === 1) onChange(contas[0].id); // só uma conta → já seleciona
  }

  const fmt = useDinheiro({ entrada: 'ouZero' });

  return (
    <div className="rounded-xl bg-muted/30 p-3 space-y-3">
      <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Wallet size={15} className="text-primary" /> {label || t.label}
        </span>
        <button type="button" onClick={toggle} role="switch" aria-checked={on}
                className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors ${on ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
        </button>
      </label>

      {on && (
        <div className="animate-fade-in">
          {contas.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t.vazio}</p>
          ) : (
            <>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">{t.qual}</label>
              <select value={value || ''} onChange={e => onChange(e.target.value || null)} className="input">
                <option value="">Selecione a conta…</option>
                {contas.map(c => (
                  <option key={c.id} value={c.id}>{c.nome} — {fmt(c.saldo || 0)}</option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {t.ajuda}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
