'use client';

import { User, Users, Briefcase, UserPlus, Check } from 'lucide-react';
import { useOnboarding } from '../OnboardingContext';
import type { PerfilUso } from '@/contexts/AuthContext';
import { useAuth } from '@/contexts/AuthContext';
import { podeUsar } from '@/lib/plans';
import StepNav from '../components/StepNav';

const BRAND = '#61D17B';

type Opcao = {
  id:     PerfilUso;
  titulo: string;
  desc:   string;
  icon:   typeof User;
  cor:    string;
  /** Indica se requer plano pago específico. */
  requerPremium?: boolean;
  requerBlack?:   boolean;
};

const OPCOES: Opcao[] = [
  {
    id: 'pessoal',
    titulo: 'Uso pessoal',
    desc: 'Organizar minhas finanças do dia a dia',
    icon: User,
    cor: BRAND,
  },
  {
    id: 'casal',
    titulo: 'Casal / família',
    desc: 'Gestão compartilhada com parceiro(a) ou família',
    icon: Users,
    cor: '#61ce70',
    requerPremium: true,
  },
  {
    id: 'empresarial',
    titulo: 'Empresarial',
    desc: 'Gerenciar finanças do meu negócio ou empresa',
    icon: Briefcase,
    cor: '#f59e0b',
    requerBlack: true,
  },
  {
    id: 'ambos',
    titulo: 'Pessoal + Empresarial',
    desc: 'Gerenciar tanto finanças pessoais quanto do negócio',
    icon: UserPlus,
    cor: '#a855f7',
    requerBlack: true,
  },
];

export default function Step2PerfilUso() {
  const { state, setPerfilUso } = useOnboarding();
  const { plano } = useAuth();

  return (
    <>
      <div className="space-y-3 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight">
          Como você vai usar a Sora?
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
          A gente vai adaptar tudo (categorias, recursos, dicas) ao seu cenário.
        </p>
      </div>

      <div className="space-y-3">
        {OPCOES.map((opcao) => {
          const Icon = opcao.icon;
          const ativo = state.perfilUso === opcao.id;
          const bloqueado =
            (opcao.requerPremium && !podeUsar(plano, 'compartilhamento')) ||
            (opcao.requerBlack && !podeUsar(plano, 'negocios'));

          return (
            <button
              key={opcao.id}
              type="button"
              disabled={bloqueado}
              onClick={() => setPerfilUso(opcao.id)}
              className={`relative w-full text-left p-4 sm:p-5 rounded-2xl border-2 transition-all
                ${ativo
                  ? 'bg-primary/5 shadow-glow-sm'
                  : bloqueado
                    ? 'border-border/50 bg-card/40 opacity-60 cursor-not-allowed'
                    : 'border-border bg-card hover:border-primary/40 hover:-translate-y-0.5'
                }`}
              style={ativo ? { borderColor: opcao.cor } : undefined}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${opcao.cor}1A` }}
                >
                  <Icon size={20} style={{ color: opcao.cor }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-base font-bold text-foreground">{opcao.titulo}</p>
                    {opcao.requerPremium && !podeUsar(plano, 'compartilhamento') && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                        Premium
                      </span>
                    )}
                    {opcao.requerBlack && !podeUsar(plano, 'negocios') && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                        Black
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{opcao.desc}</p>
                </div>

                {ativo && (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm"
                    style={{ background: opcao.cor }}
                  >
                    <Check size={14} className="text-white" strokeWidth={3} />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <StepNav podeAvancar={state.perfilUso != null} semPular />
    </>
  );
}
