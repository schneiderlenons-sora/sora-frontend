'use client';

import { useMemo, useState } from 'react';
import { Target, ShieldCheck, Plane, Home, GraduationCap, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import StepNav from '../components/StepNav';

const BRAND = '#61D17B';

type Sugestao = {
  id:     string;
  titulo: string;
  icon:   typeof Target;
  cor:    string;
  meses:  number;
};

const SUGESTOES: Sugestao[] = [
  { id: 'reserva',  titulo: 'Reserva de emergência', icon: ShieldCheck,     cor: BRAND,     meses: 12 },
  { id: 'viagem',   titulo: 'Viagem dos sonhos',     icon: Plane,           cor: '#3b82f6', meses: 12 },
  { id: 'casa',     titulo: 'Comprar/reformar casa', icon: Home,            cor: '#f59e0b', meses: 24 },
  { id: 'estudo',   titulo: 'Curso ou pós',          icon: GraduationCap,   cor: '#8b5cf6', meses: 6  },
];

export default function Step8PrimeiraMeta() {
  const { perfil } = useAuth();
  const [escolhida, setEscolhida] = useState<Sugestao | null>(null);
  const [titulo,    setTitulo]    = useState('');
  const [valor,     setValor]     = useState('');
  const [meses,     setMeses]     = useState('12');

  const aporteSugerido = useMemo(() => {
    const v = parseFloat(String(valor).replace(',', '.')) || 0;
    const m = parseInt(meses) || 1;
    if (v <= 0 || m <= 0) return 0;
    return v / m;
  }, [valor, meses]);

  function escolher(s: Sugestao) {
    setEscolhida(s);
    setTitulo(s.titulo);
    setMeses(String(s.meses));
  }

  async function salvar() {
    const grupoId = perfil?.grupo_ativo?.id;
    const userId  = perfil?.id;
    if (!grupoId || !userId) return;
    const t = titulo.trim();
    const v = parseFloat(String(valor).replace(',', '.')) || 0;
    if (!t || v <= 0) return;

    try {
      const dataAlvo = new Date();
      dataAlvo.setMonth(dataAlvo.getMonth() + (parseInt(meses) || 12));

      await supabase.from('metas').insert({
        grupo_id:       grupoId,
        criado_por:     userId,
        titulo:         t,
        valor_objetivo: v,
        valor_atual:    0,
        data_alvo:      dataAlvo.toISOString().slice(0, 10),
        cor:            escolhida?.cor || BRAND,
      });
    } catch (e) {
      console.warn('[onboarding] erro ao salvar meta', e);
    }
  }

  return (
    <>
      <div className="space-y-3 mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-2"
             style={{ background: `${BRAND}1A` }}>
          <Target size={20} style={{ color: BRAND }} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight">
          Sua primeira meta
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
          Defina algo pra você juntar dinheiro. A Sora calcula o aporte mensal pra bater.
          <span className="block text-xs mt-1 italic">Pode pular se ainda não tem nenhuma em mente.</span>
        </p>
      </div>

      {/* Sugestões */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {SUGESTOES.map((s) => {
          const Icon = s.icon;
          const ativo = escolhida?.id === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => escolher(s)}
              className={`text-left p-4 rounded-2xl border-2 transition-all
                ${ativo ? 'shadow-glow-sm' : 'border-border bg-card hover:border-primary/40'}`}
              style={ativo ? { borderColor: s.cor, background: `${s.cor}08` } : undefined}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2"
                   style={{ background: `${s.cor}1A` }}>
                <Icon size={16} style={{ color: s.cor }} />
              </div>
              <p className="text-sm font-bold text-foreground leading-tight">{s.titulo}</p>
            </button>
          );
        })}
      </div>

      {/* Form */}
      <div className="space-y-3 p-4 rounded-2xl border border-border bg-card">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
            Nome da meta
          </label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Viagem pro Japão"
            className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm
                       placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
              Valor objetivo
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="R$ 10.000"
              className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm tabular-nums
                         placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
              Em quantos meses
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={meses}
              onChange={(e) => setMeses(e.target.value)}
              placeholder="12"
              className="w-full px-3 py-2.5 rounded-xl bg-background border border-border text-sm tabular-nums
                         placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {aporteSugerido > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20">
            <Sparkles size={16} style={{ color: BRAND }} />
            <p className="text-xs text-foreground leading-tight">
              Pra bater essa meta, separa{' '}
              <strong className="tabular-nums" style={{ color: BRAND }}>
                R$ {aporteSugerido.toFixed(2).replace('.', ',')}
              </strong>{' '}
              por mês.
            </p>
          </div>
        )}
      </div>

      <StepNav podeAvancar={true} onAntesAvancar={titulo.trim() && parseFloat(valor) > 0 ? salvar : undefined} />
    </>
  );
}
