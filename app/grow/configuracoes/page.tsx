'use client';

import { useCallback, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import GrowHero from '@/components/grow/GrowHero';
import {
  Lock, Users, Home, Plane, Clapperboard, BookOpen,
  Loader2, ShieldCheck, Info,
} from 'lucide-react';

const BRAND = 'hsl(var(--primary))';

// Abas que SEMPRE ficam privadas (cada um o seu) — só informativo.
const PRIVADAS = [
  { label: 'Hábitos',  emoji: '🎯' },
  { label: 'Saúde',    emoji: '❤️' },
  { label: 'Tarefas',  emoji: '✅' },
  { label: 'Agenda',   emoji: '📅' },
  { label: 'Bem-estar', emoji: '🧘' },
  { label: 'Estudos',  emoji: '📚' },
];

// Abas opcionais (liga/desliga por grupo). `key` casa com o backend.
const OPCIONAIS = [
  { key: 'casa',     label: 'Casa',            desc: 'Compras, Despensa, Receitas e Manutenções', icon: Home },
  { key: 'viagens',  label: 'Viagens & Lazer', desc: 'Viagens e bucket list',                     icon: Plane },
  { key: 'midia',    label: 'Filmes & Séries', desc: 'Sua watchlist de filmes, séries e desenhos', icon: Clapperboard },
  { key: 'leituras', label: 'Leituras',        desc: 'Sua estante de livros',                      icon: BookOpen },
] as const;

type AbaKey = (typeof OPCIONAIS)[number]['key'];

export default function GrowConfiguracoesPage() {
  const { phone } = useAuth();
  const [saving, setSaving] = useState<AbaKey | null>(null);

  const { data, mutate } = useApi(
    phone ? `grow:share:${phone}` : null,
    () => api.grow.shareConfig.get(phone),
  );
  const loading = data === undefined;
  const cfg = data?.config ?? { casa: false, viagens: false, midia: false, leituras: false };
  const isAdmin = data?.isAdmin ?? true;
  const sozinho = (data?.totalMembros ?? 1) <= 1;

  const toggle = useCallback(async (aba: AbaKey) => {
    if (!phone || !isAdmin) return;
    const novo = !cfg[aba];
    setSaving(aba);
    // Otimista: atualiza na hora, reverte no erro.
    mutate((prev: any) => prev ? { ...prev, config: { ...prev.config, [aba]: novo } } : prev, false);
    try {
      await api.grow.shareConfig.set(phone, aba, novo);
      mutate();
    } catch {
      mutate(); // recarrega o estado real (reverte)
    } finally {
      setSaving(null);
    }
  }, [phone, isAdmin, cfg, mutate]);

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-6">
      <GrowHero
        badge="Compartilhamento"
        badgeIcon={Users}
        titulo="Compartilhamento"
        subtitulo="Controle o que é só seu e o que o seu grupo enxerga no Sora Grow."
      />

      {/* Sempre privado */}
      <section
        className="rounded-3xl border border-border/40 backdrop-blur-xl p-5 sm:p-6 animate-[slide-up_500ms_ease-out_both]"
        style={{ background: 'hsl(var(--bg-card) / 0.5)' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Lock size={16} style={{ color: BRAND }} />
          <h2 className="text-base font-bold text-foreground">Sempre privado</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Coisas pessoais ficam só com você — mesmo dividindo o grupo, ninguém vê (nem mexe) no que é seu.
        </p>
        <div className="flex flex-wrap gap-2">
          {PRIVADAS.map((p) => (
            <span key={p.label}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground/80 bg-foreground/[0.04] border border-border/40 px-3 py-1.5 rounded-full">
              <span aria-hidden>{p.emoji}</span> {p.label}
            </span>
          ))}
        </div>
      </section>

      {/* Compartilhamento opcional */}
      <section
        className="rounded-3xl border border-border/40 backdrop-blur-xl p-5 sm:p-6 animate-[slide-up_500ms_ease-out_both]"
        style={{ background: 'hsl(var(--bg-card) / 0.5)', animationDelay: '60ms' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Users size={16} style={{ color: BRAND }} />
          <h2 className="text-base font-bold text-foreground">Compartilhar com o grupo</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Escolha o que o grupo compartilha. Ligado, todo mundo vê e edita junto; desligado, cada um tem o seu.
        </p>

        {sozinho && (
          <div className="flex items-start gap-2.5 rounded-2xl p-3 mb-4 bg-primary/[0.06] border border-primary/20">
            <Info size={15} className="mt-0.5 flex-shrink-0" style={{ color: BRAND }} />
            <p className="text-[13px] text-foreground/80 leading-snug">
              Você ainda não tem ninguém no grupo. O compartilhamento passa a valer quando você
              adicionar alguém na <strong>Gestão Compartilhada</strong>.
            </p>
          </div>
        )}

        {loading ? (
          <div className="py-10 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin" style={{ color: BRAND }} />
          </div>
        ) : (
          <div className="space-y-2.5">
            {OPCIONAIS.map((aba, i) => {
              const on = !!cfg[aba.key];
              const Icon = aba.icon;
              const disabled = !isAdmin || saving === aba.key;
              return (
                <div key={aba.key}
                  className="flex items-center gap-3 rounded-2xl border border-border/40 p-3.5 animate-[slide-up_500ms_ease-out_both]"
                  style={{ background: 'hsl(var(--bg-subtle) / 0.5)', animationDelay: `${i * 40}ms` }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: on ? 'color-mix(in srgb, hsl(var(--primary)) 16%, transparent)' : 'hsl(var(--foreground) / 0.05)' }}>
                    <Icon size={17} style={{ color: on ? BRAND : 'hsl(var(--muted-foreground))' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground leading-tight">{aba.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{aba.desc}</p>
                  </div>
                  <span className="text-[11px] font-semibold mr-1 flex items-center gap-1"
                    style={{ color: on ? BRAND : 'hsl(var(--muted-foreground))' }}>
                    {on ? <><Users size={12} /> Grupo</> : <><Lock size={12} /> Só você</>}
                  </span>
                  <button
                    role="switch"
                    aria-checked={on}
                    aria-label={`Compartilhar ${aba.label}`}
                    disabled={disabled}
                    onClick={() => toggle(aba.key)}
                    className="relative w-12 h-7 rounded-full flex-shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: on ? BRAND : 'hsl(var(--foreground) / 0.15)', minWidth: 48, minHeight: 28 }}
                  >
                    <span
                      className="absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform"
                      style={{ transform: on ? 'translateX(20px)' : 'translateX(0)' }}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {!isAdmin && !loading && (
          <div className="flex items-center gap-2 mt-4 text-[13px] text-muted-foreground">
            <ShieldCheck size={14} /> Só o admin do grupo pode mudar o compartilhamento.
          </div>
        )}
      </section>
    </div>
  );
}
