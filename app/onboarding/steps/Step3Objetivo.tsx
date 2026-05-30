'use client';

import { TrendingDown, Target, BarChart3, Briefcase, Check } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';
import type { ObjetivoPrincipal } from '@/contexts/AuthContext';
import StepNav from '../components/StepNav';

const BRAND = '#61D17B';

type Opcao = {
  id:     ObjetivoPrincipal;
  titulo: string;
  desc:   string;
  icon:   typeof TrendingDown;
  cor:    string;
};

const OPCOES: Opcao[] = [
  { id: 'vermelho',  titulo: 'Sair do vermelho',     desc: 'Pagar dívidas e equilibrar o orçamento',         icon: TrendingDown, cor: '#ef4444' },
  { id: 'meta',      titulo: 'Criar uma meta',       desc: 'Viagem, casa, carro, reserva de emergência',           icon: Target,       cor: '#3b82f6' },
  { id: 'organizar', titulo: 'Organizar melhor',     desc: 'Saber para onde vai meu dinheiro e otimizar gastos',   icon: BarChart3,    cor: BRAND     },
  { id: 'negocio',   titulo: 'Crescer meu negócio',  desc: 'Lucro, DRE, fluxo de caixa, projeções',          icon: Briefcase,    cor: '#f59e0b' },
];

export default function Step3Objetivo() {
  const { state, setObjetivo } = useOnboarding();

  return (
    <>
      <div className="space-y-3 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight">
          Qual seu maior objetivo agora?
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
          Vou destacar os recursos certos pra você atingir essa meta mais rápido.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {OPCOES.map((opcao) => {
          const Icon = opcao.icon;
          const ativo = state.objetivo === opcao.id;

          return (
            <button
              key={opcao.id}
              type="button"
              onClick={() => setObjetivo(opcao.id)}
              className={`relative text-left p-5 rounded-2xl border-2 transition-all
                ${ativo
                  ? 'shadow-glow-sm bg-primary/5'
                  : 'border-border bg-card hover:border-primary/40 hover:-translate-y-0.5'
                }`}
              style={ativo ? { borderColor: opcao.cor } : undefined}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
                style={{ background: `${opcao.cor}1A` }}
              >
                <Icon size={20} style={{ color: opcao.cor }} />
              </div>

              <p className="text-base font-bold text-foreground">{opcao.titulo}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-snug">{opcao.desc}</p>

              {ativo && (
                <div
                  className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center shadow-sm"
                  style={{ background: opcao.cor }}
                >
                  <Check size={12} className="text-white" strokeWidth={3} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <StepNav podeAvancar={state.objetivo != null} />
    </>
  );
}
