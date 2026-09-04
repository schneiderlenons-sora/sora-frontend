'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Lock, ArrowLeft, Sparkles, Activity, Building2, FolderLock,
  Gift, CalendarDays, TrendingUp, Home, GraduationCap, Plane,
} from 'lucide-react';
import { planoMinimo, PLANO_LABEL, type Feature } from '@/lib/plans';

/**
 * O convite que aparece quando a pessoa abre uma aba que o plano dela não tem.
 *
 * ⚠️ SUBSTITUI UM REDIRECT. Antes, clicar numa aba bloqueada jogava direto pro
 * /planos — a pessoa saía do lugar onde clicou e caía numa tabela de preços sem
 * saber mais qual aba tinha pedido. O card resolve isso ficando NO lugar da
 * aba, dizendo o nome dela e o que ela faz.
 *
 * ⚠️ NADA DE CADEADO SOZINHO. O ponto do card não é avisar que está trancado —
 * a sidebar já mostra o cadeado. É mostrar o que existe do outro lado, com o
 * nome do plano certo: `planoMinimo` devolve o MENOR plano que libera a
 * feature, então uma aba de Básico não anuncia "Premium" e faz a pessoa pagar
 * mais do que precisa.
 */

/** Copy por feature. Sem entrada = texto genérico (nunca quebra). */
const COPY: Partial<Record<Feature, { titulo: string; texto: string; icone: React.ReactNode }>> = {
  grow_saude: {
    titulo: 'Saúde',
    texto: 'Treinos, consultas, exames e macros por foto da comida — tudo junto do seu dinheiro.',
    icone: <Activity size={26} />,
  },
  open_finance: {
    titulo: 'Open Finance',
    texto: 'Conecte seu banco e as transações entram sozinhas, já categorizadas. Sem digitar nada.',
    icone: <Building2 size={26} />,
  },
  drive_painel: {
    titulo: 'Drive',
    texto: 'Guarde comprovantes, contratos e senhas num lugar só — e ache tudo depois pelo nome.',
    icone: <FolderLock size={26} />,
  },
  wrapped: {
    titulo: 'Sora Wrapped',
    texto: 'Sua retrospectiva: para onde o dinheiro foi, o que mudou e o que se repetiu no ano.',
    icone: <Gift size={26} />,
  },
  grow_agenda: {
    titulo: 'Agenda',
    texto: 'Tudo que tem data num calendário só: contas, faturas, consultas e compromissos.',
    icone: <CalendarDays size={26} />,
  },
  agentes: {
    titulo: 'Agentes',
    texto: 'O Watson acha lançamento duplicado, o Oráculo diz se a compra cabe no seu bolso.',
    icone: <Sparkles size={26} />,
  },
  investimentos: {
    titulo: 'Investimentos',
    texto: 'Carteira, rentabilidade, proventos e reserva de emergência no mesmo painel.',
    icone: <TrendingUp size={26} />,
  },
  grow_casa: {
    titulo: 'Casa',
    texto: 'Lista de compras, despensa, receitas e manutenções da casa — sem outro app.',
    icone: <Home size={26} />,
  },
  grow_estudos: {
    titulo: 'Estudos',
    texto: 'Matérias, revisões e horas de estudo acompanhadas junto do resto da sua rotina.',
    icone: <GraduationCap size={26} />,
  },
  grow_colecoes: {
    titulo: 'Coleções',
    texto: 'Viagens, filmes, séries e leituras — o que você quer fazer, guardado e organizado.',
    icone: <Plane size={26} />,
  },
};

export default function AbaBloqueada({ feature }: { feature: Feature }) {
  const router = useRouter();
  const info = COPY[feature];
  const minimo = planoMinimo(feature);
  const nomePlano = PLANO_LABEL[minimo];

  return (
    // `min-h-[70vh]` centraliza sem depender do conteúdo da aba, que não existe.
    <div className="min-h-[70vh] flex items-center justify-center px-4 animate-[fade-in_400ms_ease-out_both]">
      {/* max-w-md é CONTEÚDO, não container: o layout do painel já centraliza. */}
      <div
        className="w-full max-w-md rounded-3xl border border-border/40 backdrop-blur-xl p-7 sm:p-8 text-center relative overflow-hidden"
        style={{ background: 'hsl(var(--bg-card) / 0.5)' }}
      >
        {/* Glow do design system do Grow — mesma receita dos cards de lá. */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle at top right, hsl(var(--primary) / 0.14) 0%, transparent 70%)' }}
        />

        <div className="relative">
          <span
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: 'color-mix(in srgb, hsl(var(--primary)) 13%, transparent)', color: 'hsl(var(--primary))' }}
            aria-hidden
          >
            {info?.icone ?? <Lock size={26} />}
          </span>

          {/* Ícone + rótulo, nunca a cor sozinha. */}
          <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            <Lock size={11} /> Disponível no {nomePlano}
          </p>

          <h1 className="text-2xl font-bold text-foreground tracking-tight leading-tight">
            {info?.titulo ?? 'Esta aba é de outro plano'}
          </h1>

          <p className="text-sm text-muted-foreground leading-relaxed mt-2.5">
            {info?.texto ?? `Faça upgrade pro plano ${nomePlano} pra desbloquear esta aba.`}
          </p>

          {/* `intent=upgrade` faz o /planos abrir já com o card certo destacado,
              em vez de a pessoa ter de procurar qual plano resolve. */}
          <Link
            href={`/planos?intent=upgrade&plano=${minimo}&ciclo=mensal`}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 h-12 rounded-2xl text-white text-sm font-bold shadow-lg active:scale-[0.99] transition-transform"
            style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), #3FA85A)', minHeight: 44 }}
          >
            Ver o plano {nomePlano}
          </Link>

          {/* Saída sempre visível: sem ela a aba bloqueada vira beco sem saída
              no mobile, onde não há sidebar à vista. */}
          <button
            type="button"
            onClick={() => router.back()}
            className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 h-11 rounded-2xl text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            style={{ minHeight: 44 }}
          >
            <ArrowLeft size={15} /> Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
