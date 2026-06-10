'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Target, Check, Plus } from 'lucide-react';

const iso = (d: Date) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
const diaSemBR = () => { const j = new Date().getDay(); return j === 0 ? 7 : j; };

export default function GrowHabitosCard() {
  const { phone, temAcessoGrow } = useAuth();
  const [habitos, setHabitos]     = useState<any[]>([]);
  const [registros, setRegistros] = useState<any[]>([]);

  const carregar = useCallback(async () => {
    if (!phone) return;
    try {
      const r = await api.grow.habitos.listar(phone, { dias: 7 });
      setHabitos(r.habitos || []);
      setRegistros(r.registros || []);
    } catch { /* tolerante */ }
  }, [phone]);

  useEffect(() => { carregar(); }, [carregar]);

  const hojeStr = iso(new Date());
  const diaSem = diaSemBR();
  const habitosHoje = habitos.filter(h => h.ativo && (h.dias_semana || [1, 2, 3, 4, 5, 6, 7]).includes(diaSem));
  const feitos = new Set(registros.filter(r => r.data === hojeStr && r.concluido).map(r => r.habito_id));
  const habFeitos = habitosHoje.filter(h => feitos.has(h.id)).length;
  const habPct = habitosHoje.length ? Math.round((habFeitos / habitosHoje.length) * 100) : 0;

  // Check-in otimista — atualiza UI na hora, chama API, reverte no erro.
  const toggleHabito = useCallback(async (h: any) => {
    if (!phone) return;
    const jaFeito = registros.some(r => r.habito_id === h.id && r.data === hojeStr && r.concluido);
    const snapshot = registros;
    const semHoje = registros.filter(r => !(r.habito_id === h.id && r.data === hojeStr));
    setRegistros(jaFeito ? semHoje : [...semHoje, { habito_id: h.id, data: hojeStr, concluido: true }]);
    try { await api.grow.habitos.toggle(h.id, { phone, data: hojeStr }); }
    catch { setRegistros(snapshot); }
  }, [phone, registros, hojeStr]);

  if (!temAcessoGrow) return null;

  return (
    <div className="card rounded-3xl p-5 sm:p-6 flex flex-col h-full animate-fade-in" style={{ animationDelay: '60ms' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'color-mix(in srgb, hsl(var(--primary)) 14%, transparent)' }}>
            <Target size={17} className="text-primary" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none">Hábitos de hoje</p>
            <p className="text-sm font-bold text-foreground leading-tight mt-0.5">
              {habitosHoje.length ? `${habFeitos} de ${habitosHoje.length} concluídos` : 'Sem hábitos hoje'}
            </p>
          </div>
        </div>
        <span className="text-base font-bold tabular-nums text-primary flex-shrink-0">{habPct}%</span>
      </div>

      {habitosHoje.length > 0 && (
        <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-4">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${habPct}%` }} />
        </div>
      )}

      {habitosHoje.length > 0 ? (
        <div className="space-y-1.5 -mx-1 flex-1 overflow-y-auto pr-1" style={{ maxHeight: 240 }}>
          {habitosHoje.map((h, i) => {
            const done = feitos.has(h.id);
            const cor = h.cor || 'hsl(var(--primary))';
            return (
              <button
                key={h.id}
                onClick={() => toggleHabito(h)}
                role="checkbox"
                aria-checked={done}
                aria-label={`${done ? 'Desmarcar' : 'Marcar'} ${h.nome}`}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left transition-colors hover:bg-muted/50 active:scale-[0.99] animate-fade-in"
                style={{ animationDelay: `${i * 40}ms`, minHeight: 44 }}
              >
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all border-2"
                  style={done
                    ? { background: cor, borderColor: cor }
                    : { borderColor: 'color-mix(in srgb, var(--fg-muted, #888) 40%, transparent)' }}
                >
                  {done && <Check size={15} className="text-white" strokeWidth={3} />}
                </span>
                {h.icone && <span className="text-base flex-shrink-0">{h.icone}</span>}
                <span className={`text-sm flex-1 truncate transition-colors ${done ? 'text-muted-foreground line-through' : 'text-foreground font-medium'}`}>
                  {h.nome}
                </span>
                {h.streak > 0 && (
                  <span className="text-[11px] font-bold tabular-nums flex-shrink-0" style={{ color: cor }}>
                    🔥 {h.streak}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
               style={{ background: 'color-mix(in srgb, hsl(var(--primary)) 10%, transparent)' }}>
            <Target size={20} className="text-primary" />
          </div>
          <p className="text-sm font-semibold text-foreground">Nenhum hábito pra hoje</p>
          <Link href="/grow/habitos" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            <Plus size={13} /> Criar hábito
          </Link>
        </div>
      )}

      {habitosHoje.length > 0 && habFeitos === habitosHoje.length && (
        <p className="text-xs font-semibold text-primary text-center mt-3 pt-3 border-t border-border/50">
          🎉 Todos os hábitos de hoje concluídos!
        </p>
      )}
    </div>
  );
}
