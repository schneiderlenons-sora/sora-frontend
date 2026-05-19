'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sprout, Check, Sparkles, Target, ListChecks, Heart,
  Home, ShoppingCart, Calendar, Loader2, Crown, Zap,
} from 'lucide-react';

const BRAND = '#7c3aed';

const FEATURES = [
  { icon: Target,      label: 'Hábitos com streak e calendário heatmap' },
  { icon: ListChecks,  label: 'Tarefas com prioridades e projetos em Kanban' },
  { icon: Heart,       label: 'Bem-estar: humor, gratidão, energia, sono' },
  { icon: ShoppingCart,label: 'Lista de compras compartilhada' },
  { icon: Calendar,    label: 'Rotinas matutinas e noturnas' },
  { icon: Sparkles,    label: 'Integração total com WhatsApp da Sora' },
];

export default function GrowUpgradePage() {
  const { perfil, isPremium, isBlack, ativarTrialGrow, temAcessoGrow } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  if (temAcessoGrow) {
    router.replace('/grow/dashboard');
  }

  const podeAtivarTrial = (isPremium || isBlack) && perfil?.plano_grow === 'sem_acesso';

  async function ativarTrial() {
    setLoading(true); setErro('');
    try {
      await ativarTrialGrow();
      router.push('/grow/dashboard');
    } catch (e: any) {
      setErro(e.message || 'Erro ao ativar trial.');
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-5xl mx-auto pb-20 space-y-8">
        {/* HERO */}
        <div
          className="relative overflow-hidden rounded-3xl p-8 sm:p-12 text-white shadow-2xl"
          style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #6366f1 100%)' }}
        >
          <div className="absolute inset-0 opacity-30"
               style={{ background: 'radial-gradient(circle at top right, rgba(255,255,255,0.4), transparent 60%)' }} />
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur mb-5 border border-white/20">
              <Sparkles size={13} />
              <span className="text-[11px] font-bold uppercase tracking-widest">Novo · Sora Grow</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05]">
              O dinheiro está sob controle.
              <br />
              <span className="text-white/85">Agora organize a vida.</span>
            </h1>
            <p className="text-white/85 text-lg mt-4 max-w-xl leading-relaxed">
              Sora Grow é o segundo painel pra você cuidar de hábitos, tarefas, bem-estar e casa — tudo conversando com a Sora pelo WhatsApp.
            </p>
            <div className="flex flex-wrap gap-3 mt-7">
              {podeAtivarTrial ? (
                <button
                  onClick={ativarTrial}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-violet-700 font-bold text-sm shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                  Ativar 7 dias grátis
                </button>
              ) : (
                <button
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-violet-700 font-bold text-sm shadow-xl opacity-60 cursor-not-allowed"
                  disabled
                  title="Disponível para planos Premium e Black"
                >
                  <Crown size={16} /> Trial — Premium e Black
                </button>
              )}
              <button
                onClick={() => router.push('/dashboard')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/10 backdrop-blur border border-white/25 text-white font-semibold text-sm hover:bg-white/20 transition-all"
              >
                Voltar ao Finance
              </button>
            </div>
            {erro && <p className="text-red-100 text-sm mt-4 bg-red-500/30 inline-block px-3 py-1.5 rounded-lg">{erro}</p>}
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, label }, i) => (
            <div
              key={i}
              className="card rounded-2xl p-5 hover:shadow-glow-sm transition-all animate-fade-in"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
                   style={{ background: `${BRAND}18` }}>
                <Icon size={20} style={{ color: BRAND }} />
              </div>
              <p className="text-sm font-semibold text-foreground leading-snug">{label}</p>
            </div>
          ))}
        </div>

        {/* Planos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PlanoCard
            nome="Grow Avulso"
            preco="R$ 19,90"
            sub="/mês — apenas o Grow"
            badge={null}
            features={[
              'Hábitos, tarefas, bem-estar, casa',
              'Comandos no WhatsApp',
              'Suporte por e-mail',
            ]}
            cta="Em breve"
            disabled
          />
          <PlanoCard
            destaque
            nome="Grow Premium"
            preco="R$ 29,90"
            sub="/mês — Finance + Grow"
            badge="Mais popular"
            features={[
              'Tudo do Finance Premium',
              'Tudo do Grow Avulso',
              'Análises de IA cruzando finanças + bem-estar',
              'Suporte prioritário',
            ]}
            cta="Em breve"
            disabled
          />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Já é <strong>Black</strong>? Você tem o Grow incluído. Já é <strong>Premium</strong>? Ative seu trial de 7 dias acima.
        </p>
    </div>
  );
}

function PlanoCard({ nome, preco, sub, badge, features, cta, destaque, disabled }: any) {
  return (
    <div className={`card rounded-3xl p-7 relative ${destaque ? 'ring-2' : ''}`}
         style={destaque ? { boxShadow: '0 0 40px -10px rgba(124, 58, 237, 0.4)', ['--tw-ring-color' as any]: BRAND } : {}}>
      {badge && (
        <span className="absolute -top-3 left-7 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white"
              style={{ background: BRAND }}>
          {badge}
        </span>
      )}
      <h3 className="text-lg font-bold text-foreground">{nome}</h3>
      <div className="flex items-baseline gap-1 mt-2">
        <span className="text-3xl font-bold text-foreground tabular tracking-tight">{preco}</span>
        <span className="text-xs text-muted-foreground">{sub}</span>
      </div>
      <ul className="mt-5 space-y-2">
        {features.map((f: string, i: number) => (
          <li key={i} className="flex items-start gap-2 text-sm text-foreground">
            <Check size={15} className="mt-0.5 flex-shrink-0" style={{ color: BRAND }} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <button
        disabled={disabled}
        className={`mt-6 w-full px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
          destaque
            ? 'bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50'
            : 'bg-muted text-foreground hover:bg-muted/70 disabled:opacity-50'
        }`}
      >
        {cta}
      </button>
    </div>
  );
}
