'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
  Sprout, Target, ListChecks, Heart, ShoppingCart, Sparkles,
  Loader2, ArrowRight, Check, Flame,
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from 'recharts';

const BRAND = '#7c3aed';

const FRASES = [
  'Pequenos passos consistentes vencem grandes saltos esporádicos.',
  'O melhor momento para começar foi ontem. O segundo melhor é agora.',
  'Disciplina é o ponte entre objetivos e conquistas.',
  'Você não precisa ser extraordinário hoje. Só precisa aparecer.',
  'A vida boa é construída em hábitos invisíveis.',
];

function saudacao() {
  const h = new Date().getHours();
  if (h < 6)  return 'Boa madrugada';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function GrowDashboardPage() {
  const { phone, perfil } = useAuth();
  const [data, setData] = useState<any>({ habitos: [], registros: [], tarefas: [], humor: [], compras: [] });
  const [loading, setLoading] = useState(true);
  const frase = FRASES[new Date().getDate() % FRASES.length];

  const carregar = useCallback(async () => {
    if (!phone) return;
    setLoading(true);
    try {
      const [h, t, mood, c] = await Promise.all([
        api.grow.habitos.listar(phone).catch(() => ({ habitos: [], registros: [] })),
        api.grow.tarefas.listar(phone, { concluida: false }).catch(() => []),
        api.grow.humor.listar(phone, 7).catch(() => []),
        api.grow.compras.listar(phone).catch(() => ({ lista_id: '', itens: [] })),
      ]);
      setData({ habitos: h.habitos, registros: h.registros, tarefas: t, humor: mood, compras: c.itens });
    } finally { setLoading(false); }
  }, [phone]);

  useEffect(() => { carregar(); }, [carregar]);

  const hoje = new Date().toISOString().slice(0, 10);

  // Derivações memoizadas — só recalculam quando os dados base mudam
  const habitosConcluidosHoje = useMemo(
    () => new Set(data.registros.filter((r: any) => r.data === hoje && r.concluido).map((r: any) => r.habito_id)),
    [data.registros, hoje]
  );
  const tarefasHoje = useMemo(
    () => data.tarefas.filter((t: any) => !t.concluida).slice(0, 5),
    [data.tarefas]
  );
  const comprasPendentes = useMemo(
    () => data.compras.filter((i: any) => !i.comprado).length,
    [data.compras]
  );
  const humorMedio = useMemo(() => data.humor.length
    ? (data.humor.reduce((s: number, r: any) => s + r.humor, 0) / data.humor.length).toFixed(1)
    : null,
    [data.humor]
  );

  // Toggle otimista — atualiza UI imediatamente, persiste em background,
  // reverte só se a API falhar. Sem tela de carregando piscando.
  async function toggleHabito(h: any) {
    if (!phone) return;
    const jaConcluido = habitosConcluidosHoje.has(h.id);
    const novoValor = !jaConcluido;

    // Update otimista nos registros locais
    setData((prev: any) => {
      const sem = prev.registros.filter((r: any) => !(r.habito_id === h.id && r.data === hoje));
      const novosRegistros = novoValor
        ? [...sem, { habito_id: h.id, data: hoje, concluido: true }]
        : sem;
      return { ...prev, registros: novosRegistros };
    });

    try {
      await api.grow.habitos.toggle(h.id, { phone });
    } catch (e: any) {
      // Reverte
      setData((prev: any) => {
        const sem = prev.registros.filter((r: any) => !(r.habito_id === h.id && r.data === hoje));
        const restaurado = jaConcluido
          ? [...sem, { habito_id: h.id, data: hoje, concluido: true }]
          : sem;
        return { ...prev, registros: restaurado };
      });
      alert(e.message);
    }
  }

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-6">
      {/* HERO */}
      <div
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8 border border-border/60 animate-fade-in"
        style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card)) 0%, hsl(var(--bg-subtle)) 100%)' }}
      >
        <div className="absolute inset-0 pointer-events-none opacity-60"
             style={{ background: 'radial-gradient(ellipse at top right, rgba(124,58,237,0.14) 0%, transparent 60%)' }} />
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-violet-100 dark:bg-violet-950/40 mb-3">
            <Sprout size={11} style={{ color: BRAND }} />
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: BRAND }}>Sora Grow</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">
            {saudacao()}, {perfil?.name?.split(' ')[0] || 'amigo'} 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-md leading-relaxed">{frase}</p>
        </div>
      </div>

      {loading ? (
        <div className="card rounded-3xl p-12 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-violet-600" />
        </div>
      ) : (
        <>
          {/* STATS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in" style={{ animationDelay: '60ms' }}>
            <StatCard
              icon={Target}
              label="Hábitos hoje"
              value={`${habitosConcluidosHoje.size}/${data.habitos.length}`}
              cor={BRAND}
              href="/grow/habitos"
            />
            <StatCard
              icon={ListChecks}
              label="Tarefas pendentes"
              value={String(data.tarefas.length)}
              cor="#0ea5e9"
              href="/grow/tarefas"
            />
            <StatCard
              icon={Heart}
              label="Humor (7d)"
              value={humorMedio ? `${humorMedio}/5` : '—'}
              cor="#ec4899"
              href="/grow/bem-estar"
            />
            <StatCard
              icon={ShoppingCart}
              label="Lista de compras"
              value={String(comprasPendentes)}
              cor="#f59e0b"
              href="/grow/casa"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in" style={{ animationDelay: '120ms' }}>
            {/* HABITOS HOJE */}
            <div className="card rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground">Hábitos de hoje</h2>
                <Link href="/grow/habitos" className="text-xs font-semibold text-violet-600 hover:underline flex items-center gap-1">
                  Ver todos <ArrowRight size={11} />
                </Link>
              </div>
              {data.habitos.length === 0 ? (
                <EmptyMini
                  texto="Nenhum hábito cadastrado ainda."
                  link="/grow/habitos"
                  cta="Criar primeiro hábito"
                />
              ) : (
                <div className="space-y-2">
                  {data.habitos.slice(0, 6).map((h: any) => {
                    const feito = habitosConcluidosHoje.has(h.id);
                    return (
                      <button
                        key={h.id}
                        onClick={() => toggleHabito(h)}
                        className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all border ${
                          feito
                            ? 'bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-900/60'
                            : 'bg-muted/30 border-border/60 hover:border-violet-300 dark:hover:border-violet-800'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                          feito ? 'bg-violet-600 scale-110' : 'bg-card border-2 border-muted-foreground/30'
                        }`}>
                          {feito && <Check size={13} className="text-white" strokeWidth={3} />}
                        </div>
                        <span className="text-xl">{h.icone}</span>
                        <span className={`text-sm font-medium flex-1 text-left ${feito ? 'text-violet-700 dark:text-violet-300 line-through' : 'text-foreground'}`}>
                          {h.nome}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* HUMOR LAST 7 DAYS */}
            <div className="card rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground">Humor — últimos 7 dias</h2>
                <Link href="/grow/bem-estar" className="text-xs font-semibold text-violet-600 hover:underline flex items-center gap-1">
                  Detalhes <ArrowRight size={11} />
                </Link>
              </div>
              {data.humor.length === 0 ? (
                <EmptyMini
                  texto="Você ainda não registrou seu humor."
                  link="/grow/bem-estar"
                  cta="Registrar agora"
                />
              ) : (
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.humor.map((h: any) => ({ data: h.data?.slice(5), humor: h.humor }))}>
                      <YAxis domain={[1, 5]} hide />
                      <Tooltip
                        contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }}
                        formatter={(v: any) => [`${v}/5`, 'Humor']}
                      />
                      <Line
                        type="monotone"
                        dataKey="humor"
                        stroke={BRAND}
                        strokeWidth={3}
                        dot={{ fill: BRAND, r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* TAREFAS DO DIA */}
          <div className="card rounded-3xl p-6 animate-fade-in" style={{ animationDelay: '180ms' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground">Tarefas pendentes</h2>
              <Link href="/grow/tarefas" className="text-xs font-semibold text-violet-600 hover:underline flex items-center gap-1">
                Ver Kanban <ArrowRight size={11} />
              </Link>
            </div>
            {tarefasHoje.length === 0 ? (
              <EmptyMini texto="Nenhuma tarefa pendente. Você está em dia!" link="/grow/tarefas" cta="Criar tarefa" />
            ) : (
              <div className="space-y-2">
                {tarefasHoje.map((t: any) => {
                  const corPri: any = { urgente: '#ef4444', alta: '#f97316', media: '#eab308', baixa: '#22c55e' };
                  return (
                    <div key={t.id} className="flex items-center gap-3 p-3 rounded-2xl bg-muted/30 border border-border/60">
                      <span className="w-2 h-2 rounded-full" style={{ background: corPri[t.prioridade] || '#eab308' }} />
                      <p className="text-sm font-medium text-foreground flex-1">{t.titulo}</p>
                      {t.projetos && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: `${t.projetos.cor}22`, color: t.projetos.cor }}>
                          {t.projetos.icone} {t.projetos.nome}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, cor, href }: any) {
  return (
    <Link href={href} className="card rounded-2xl p-5 hover:shadow-glow-sm transition-all hover:scale-[1.02]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tabular tracking-tight mt-1.5" style={{ color: cor }}>{value}</p>
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${cor}18` }}>
          <Icon size={18} style={{ color: cor }} />
        </div>
      </div>
    </Link>
  );
}

function EmptyMini({ texto, link, cta }: { texto: string; link: string; cta: string }) {
  return (
    <div className="rounded-2xl py-8 text-center">
      <p className="text-sm text-muted-foreground mb-3">{texto}</p>
      <Link href={link} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition-all">
        {cta} <ArrowRight size={11} />
      </Link>
    </div>
  );
}
