'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
  Activity, Loader2, Scale, Droplets, Dumbbell, Sparkles, Plus, ArrowRight,
  CalendarHeart, Pill, AlertCircle, TrendingDown, TrendingUp, Minus,
  Check, X, ChevronRight,
} from 'lucide-react';
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts';

const BRAND = '#7c3aed';

const MACRO_CORES = {
  calorias: { fg: '#a78bfa', bg: 'rgba(167, 139, 250, 0.15)', label: 'Calorias',  unidade: 'kcal' },
  proteinas:{ fg: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)',  label: 'Proteínas', unidade: 'g' },
  carbos:   { fg: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)',  label: 'Carbos',    unidade: 'g' },
  gorduras: { fg: '#10b981', bg: 'rgba(16, 185, 129, 0.15)',  label: 'Gorduras',  unidade: 'g' },
};

function saudacao() {
  const h = new Date().getHours();
  if (h < 6)  return 'Boa madrugada';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

const fmtData = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
};

export default function SaudeDashboardPage() {
  const { phone, perfil } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [modalPeso, setModalPeso] = useState(false);
  const [addingAgua, setAddingAgua] = useState<number | null>(null);

  const carregar = useCallback(async (silent = false) => {
    if (!phone) return;
    if (!silent) setLoading(true);
    try {
      const r = await api.saude.dashboard(phone);
      setData(r);
    } catch (e) { console.warn('[saude] dashboard', e); }
    finally { if (!silent) setLoading(false); }
  }, [phone]);

  useEffect(() => { carregar(); }, [carregar]);

  // Água — totalmente otimista. Sem disable de botão, sem piscar nada.
  // Recalcula hoje_ml + pct na hora e revalida em background.
  async function adicionarAgua(ml: number) {
    if (!phone) return;
    setAddingAgua(ml);
    setData((prev: any) => {
      if (!prev?.agua) return prev;
      const novoMl = (prev.agua.hoje_ml || 0) + ml;
      const meta   = prev.agua.meta_ml || 2000;
      return {
        ...prev,
        agua: { ...prev.agua, hoje_ml: novoMl, pct: Math.round((novoMl / meta) * 100) },
      };
    });
    setTimeout(() => setAddingAgua(null), 250);
    try {
      await api.saude.agua.registrar({ phone, ml });
      carregar(true); // revalida silenciosamente
    } catch (e: any) {
      alert(e.message);
      carregar(true); // reverte buscando do servidor
    }
  }

  if (loading) {
    return (
      <div className="card rounded-3xl p-16 flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-violet-600" />
      </div>
    );
  }

  const semPerfil = !data?.perfil?.altura_cm;
  const semPeso   = !data?.peso_atual;

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-5">

      {/* ═══════════ HERO ═══════════ */}
      <HeroCard
        peso={data?.peso_atual}
        pesoData={data?.peso_data}
        imc={data?.imc}
        imcClass={data?.imc_classificacao}
        metaProjecao={data?.meta_projecao}
        semPerfil={semPerfil}
        semPeso={semPeso}
        onAddPeso={() => setModalPeso(true)}
      />

      {/* ═══════════ STAT TILES ═══════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in" style={{ animationDelay: '60ms' }}>
        <StatTile
          icon={Scale}
          label="Peso atual"
          value={data?.peso_atual ? `${data.peso_atual} kg` : '—'}
          subtitle={data?.peso_data ? `em ${fmtData(data.peso_data)}` : 'sem registros'}
          cor={BRAND}
        />
        <StatTile
          icon={Activity}
          label="IMC"
          value={data?.imc ? data.imc.toFixed(1) : '—'}
          subtitle={data?.imc_classificacao?.label || (semPerfil ? 'configure altura' : '—')}
          cor={data?.imc_classificacao?.cor || '#94a3b8'}
        />
        <StatTile
          icon={Droplets}
          label="Água hoje"
          value={`${((data?.agua?.hoje_ml || 0) / 1000).toFixed(1)}L`}
          subtitle={`de ${((data?.agua?.meta_ml || 2000) / 1000).toFixed(1)}L · ${data?.agua?.pct || 0}%`}
          cor="#06b6d4"
        />
        <StatTile
          icon={Dumbbell}
          label="Treinos esta semana"
          value={String(data?.treinos_semana?.count || 0)}
          subtitle={`${data?.treinos_semana?.minutos || 0} min`}
          cor="#f59e0b"
        />
      </div>

      {/* ═══════════ CHARTS ROW 1 ═══════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 animate-fade-in" style={{ animationDelay: '120ms' }}>
        <CardPeso historico={data?.historico_peso || []} pesoAtual={data?.peso_atual} metaPeso={data?.perfil?.meta_peso_kg} />
        <CardMacros macros={data?.macros_hoje} meta={data?.meta_macros} />
      </div>

      {/* ═══════════ ROW 2: AGUA + COMPROMISSOS ═══════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 animate-fade-in" style={{ animationDelay: '180ms' }}>
        <CardAgua
          hoje={data?.agua?.hoje_ml || 0}
          meta={data?.agua?.meta_ml || 2000}
          pct={data?.agua?.pct || 0}
          onAdd={adicionarAgua}
          adding={addingAgua}
        />
        <CardCompromissos
          consultas={data?.consultas_proximas || []}
          medicamentos={data?.medicamentos_ativos || []}
        />
      </div>

      {/* ═══════════ FOOTER QUICK ACTIONS ═══════════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 animate-fade-in" style={{ animationDelay: '240ms' }}>
        <QuickAction icon={Scale}     label="Registrar peso"  onClick={() => setModalPeso(true)} />
        <QuickActionLink icon={Plus}  label="Registrar refeição" href="/grow/saude/nutricao" />
        <QuickActionLink icon={Dumbbell} label="Registrar treino" href="/grow/saude/treinos" />
        <QuickActionLink icon={Check} label="Check-up de hoje"  href="/grow/saude/registro" />
      </div>

      {modalPeso && phone && (
        <ModalPeso phone={phone} onClose={() => setModalPeso(false)} onSuccess={() => { carregar(true); setModalPeso(false); }} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// HERO
// ═══════════════════════════════════════════════════════════════════
function HeroCard({ peso, pesoData, imc, imcClass, metaProjecao, semPerfil, semPeso, onAddPeso }: any) {
  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-border/60 p-6 sm:p-8 animate-fade-in"
      style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card)) 0%, hsl(var(--bg-subtle)) 100%)' }}
    >
      <div className="absolute inset-0 pointer-events-none opacity-50"
           style={{ background: 'radial-gradient(ellipse at top right, rgba(124,58,237,0.12) 0%, transparent 60%)' }} />

      <div className="relative">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-violet-100 dark:bg-violet-950/40 mb-3">
          <Sparkles size={12} style={{ color: BRAND }} />
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: BRAND }}>Saúde</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">
          Saúde
        </h1>

        {/* Highlight insight ou CTA */}
        {semPerfil || semPeso ? (
          <p className="text-sm text-muted-foreground mt-2 max-w-md leading-relaxed">
            {semPerfil
              ? <>Configure sua <Link href="/grow/saude/registro" className="text-violet-600 dark:text-violet-400 font-semibold underline-offset-2 hover:underline">altura e perfil</Link> pra ativar IMC e metas inteligentes.</>
              : <>Registre seu <button onClick={onAddPeso} className="text-violet-600 dark:text-violet-400 font-semibold underline underline-offset-2">primeiro peso</button> pra acompanhar evolução.</>
            }
          </p>
        ) : metaProjecao ? (
          <p className="text-sm text-muted-foreground mt-2 max-w-md leading-relaxed">
            Faltam <strong className="text-foreground tabular">{metaProjecao.kg_restantes} kg</strong> pra meta de {metaProjecao.direcao === 'perder' ? 'perda' : 'ganho'}.
            {' '}Projeção: <strong className="text-foreground">{fmtData(metaProjecao.data_projetada)}</strong>
            {metaProjecao.data_objetivo && (
              <> · objetivo seu: <span className="text-foreground">{fmtData(metaProjecao.data_objetivo)}</span></>
            )}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground mt-2 max-w-md leading-relaxed">
            Acompanhe peso, IMC, hidratação, treinos, nutrição e medicamentos em um só lugar.
          </p>
        )}

        {/* Highlight stats inline */}
        {!semPeso && (
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3 mt-6">
            <Highlight label="Peso atual"  value={`${peso}`} unit="kg" />
            {imc && (
              <Highlight
                label="IMC"
                value={imc.toFixed(1)}
                unit={imcClass?.label.toLowerCase().split(' ')[0]}
                unitColor={imcClass?.cor}
              />
            )}
            {pesoData && (
              <p className="text-[11px] text-muted-foreground self-end mb-1">
                Última pesagem em <strong className="text-foreground">{fmtData(pesoData)}</strong>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Highlight({ label, value, unit, unitColor }: any) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="flex items-baseline gap-1.5 mt-0.5">
        <span className="text-3xl font-bold text-foreground tabular tracking-tight leading-none">{value}</span>
        {unit && <span className="text-xs font-semibold" style={{ color: unitColor || 'hsl(var(--muted-foreground))' }}>{unit}</span>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STAT TILE
// ═══════════════════════════════════════════════════════════════════
function StatTile({ icon: Icon, label, value, subtitle, cor }: any) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border/40 backdrop-blur-xl p-4 transition-all hover:scale-[1.015] hover:border-border/70"
      style={{ background: 'hsl(var(--bg-card) / 0.5)' }}
    >
      <div className="absolute inset-0 pointer-events-none opacity-50"
           style={{ background: `radial-gradient(circle at top right, ${cor}18 0%, transparent 70%)` }} />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tabular tracking-tight mt-1.5 text-foreground">{value}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>
        </div>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
             style={{ background: `${cor}1A` }}>
          <Icon size={16} style={{ color: cor }} />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CARD PESO (Area chart 30 dias)
// ═══════════════════════════════════════════════════════════════════
function CardPeso({ historico, pesoAtual, metaPeso }: any) {
  const dados = useMemo(() =>
    (historico || []).map((p: any) => ({ dia: fmtData(p.data), peso: parseFloat(p.peso_kg) })),
  [historico]);

  const min = dados.length ? Math.min(...dados.map((d: any) => d.peso)) - 1 : 50;
  const max = dados.length ? Math.max(...dados.map((d: any) => d.peso)) + 1 : 100;

  const tendencia = useMemo(() => {
    if (dados.length < 2) return null;
    const primeiro = dados[0].peso;
    const ultimo   = dados[dados.length - 1].peso;
    const delta = ultimo - primeiro;
    if (Math.abs(delta) < 0.1) return { icon: Minus, label: 'estável', cor: '#94a3b8' };
    return delta < 0
      ? { icon: TrendingDown, label: `${delta.toFixed(1)}kg em ${dados.length}d`, cor: '#22c55e' }
      : { icon: TrendingUp,   label: `+${delta.toFixed(1)}kg em ${dados.length}d`, cor: '#f59e0b' };
  }, [dados]);

  return (
    <div className="lg:col-span-3 rounded-2xl border border-border/40 backdrop-blur-xl p-5"
         style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Evolução de peso</p>
          <p className="text-base font-bold text-foreground">Últimos 30 dias</p>
        </div>
        {tendencia && (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
               style={{ background: `${tendencia.cor}1A`, color: tendencia.cor }}>
            <tendencia.icon size={10} />
            {tendencia.label}
          </div>
        )}
      </div>

      {dados.length === 0 ? (
        <div className="h-40 flex flex-col items-center justify-center text-center mt-3">
          <Scale size={22} className="text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground">Sem registros nos últimos 30 dias</p>
        </div>
      ) : (
        <div className="h-48 mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dados} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="pesoGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={BRAND} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis domain={[min, max]} stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={36} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }}
                formatter={(v: any) => [`${v} kg`, 'Peso']}
              />
              <Area type="monotone" dataKey="peso" stroke={BRAND} strokeWidth={2.5} fill="url(#pesoGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {metaPeso && pesoAtual && (
        <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Meta: <strong className="text-foreground tabular">{metaPeso} kg</strong></span>
          <span className="text-muted-foreground">Faltam: <strong className="text-foreground tabular">{Math.abs(pesoAtual - metaPeso).toFixed(1)} kg</strong></span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CARD MACROS (3 rings radial)
// ═══════════════════════════════════════════════════════════════════
function CardMacros({ macros, meta }: any) {
  const calPct = meta?.calorias ? Math.min(100, Math.round((macros?.calorias || 0) / meta.calorias * 100)) : 0;
  const proPct = meta?.proteinas_g ? Math.min(100, Math.round((macros?.proteinas_g || 0) / meta.proteinas_g * 100)) : 0;
  const carPct = meta?.carboidratos_g ? Math.min(100, Math.round((macros?.carboidratos_g || 0) / meta.carboidratos_g * 100)) : 0;

  const semMeta = !meta;
  const semConsumo = !macros?.calorias;

  return (
    <div className="lg:col-span-2 rounded-2xl border border-border/40 backdrop-blur-xl p-5"
         style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Macros hoje</p>
          <p className="text-base font-bold text-foreground">{semMeta ? 'Configure metas' : 'Progresso diário'}</p>
        </div>
        <Link href="/grow/saude/nutricao" className="text-[11px] text-violet-600 dark:text-violet-400 font-semibold inline-flex items-center gap-0.5 hover:gap-1 transition-all">
          Detalhes <ArrowRight size={11} />
        </Link>
      </div>

      {semMeta ? (
        <div className="rounded-xl p-4 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900/60 text-xs">
          <p className="text-foreground font-semibold mb-1">Calculadora nutricional</p>
          <p className="text-muted-foreground leading-relaxed mb-3">
            Defina seu objetivo, atividade e perfil pra Sora calcular suas metas diárias.
          </p>
          <Link href="/grow/saude/nutricao" className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400 font-semibold">
            Calcular metas <ChevronRight size={12} />
          </Link>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-around mt-2">
            <MacroRing pct={calPct} cor={MACRO_CORES.calorias.fg}  label="kcal" value={Math.round(macros?.calorias || 0)} total={meta?.calorias} />
            <MacroRing pct={proPct} cor={MACRO_CORES.proteinas.fg} label="P"    value={Math.round(macros?.proteinas_g || 0)} total={meta?.proteinas_g} />
            <MacroRing pct={carPct} cor={MACRO_CORES.carbos.fg}    label="C"    value={Math.round(macros?.carboidratos_g || 0)} total={meta?.carboidratos_g} />
          </div>
          {!semConsumo && (
            <p className="text-[11px] text-muted-foreground text-center mt-3">
              <strong className="text-foreground tabular">{Math.round(macros?.calorias || 0)}</strong> / {meta?.calorias} kcal consumidas
            </p>
          )}
        </>
      )}
    </div>
  );
}

function MacroRing({ pct, cor, label, value, total }: any) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-20 h-20">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ pct }]} startAngle={90} endAngle={-270}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="pct" fill={cor} cornerRadius={8} background={{ fill: 'hsl(var(--muted))' }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs font-bold tabular" style={{ color: cor }}>{pct}%</span>
        </div>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1.5">{label}</p>
      <p className="text-[10px] text-muted-foreground tabular">{value}/{total || '—'}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CARD AGUA (progress bar + botões rapidos)
// ═══════════════════════════════════════════════════════════════════
function CardAgua({ hoje, meta, pct, onAdd, adding }: any) {
  const opcoes = [200, 300, 500];
  const litros = (hoje / 1000).toFixed(2);

  return (
    <div className="lg:col-span-3 rounded-2xl border border-border/40 backdrop-blur-xl p-5"
         style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Hidratação</p>
          <p className="text-base font-bold text-foreground">Água hoje</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tabular tracking-tight" style={{ color: '#06b6d4' }}>
            {litros}<span className="text-sm text-muted-foreground font-medium">L</span>
          </p>
          <p className="text-[10px] text-muted-foreground tabular">de {(meta / 1000).toFixed(1)}L</p>
        </div>
      </div>

      {/* Progresso */}
      <div className="relative h-3 rounded-full bg-muted overflow-hidden mb-4">
        <div
          className="absolute inset-y-0 left-0 transition-all duration-700 ease-out rounded-full"
          style={{
            width: `${Math.min(100, pct)}%`,
            background: 'linear-gradient(90deg, #06b6d4 0%, #0891b2 100%)',
            boxShadow: '0 0 18px rgba(6, 182, 212, 0.45)',
          }}
        />
      </div>

      {/* Botões rápidos */}
      <div className="grid grid-cols-3 gap-2">
        {opcoes.map(ml => (
          <button
            key={ml}
            onClick={() => onAdd(ml)}
            disabled={adding === ml}
            className={`group relative px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${
              adding === ml
                ? 'scale-95 bg-cyan-50 dark:bg-cyan-950/40 border-cyan-300 dark:border-cyan-800'
                : 'bg-muted/30 border-border/40 hover:border-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/30 hover:scale-[1.02] active:scale-95'
            }`}
          >
            <Plus size={11} className="inline mr-1" />
            {ml}ml
          </button>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground text-center mt-3">
        {pct >= 100 ? '✓ Meta batida hoje!' : `Faltam ${((meta - hoje) / 1000).toFixed(2)}L pra bater a meta`}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CARD COMPROMISSOS (consultas + remedios)
// ═══════════════════════════════════════════════════════════════════
function CardCompromissos({ consultas, medicamentos }: any) {
  const proximaConsulta = consultas[0];
  const remediosComHorario = medicamentos.filter((m: any) => m.horarios?.length);

  return (
    <div className="lg:col-span-2 rounded-2xl border border-border/40 backdrop-blur-xl p-5"
         style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Próximos</p>

      <div className="space-y-2">
        {proximaConsulta ? (
          <Link href="/grow/saude/consultas" className="group block p-3 rounded-xl bg-muted/40 border border-border/40 hover:border-violet-300 dark:hover:border-violet-800 transition-all">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-violet-100 dark:bg-violet-950/40">
                <CalendarHeart size={14} className="text-violet-600 dark:text-violet-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-foreground truncate">
                  {proximaConsulta.especialidade || proximaConsulta.profissional || 'Consulta'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {fmtData(proximaConsulta.data)}{proximaConsulta.hora ? ` · ${proximaConsulta.hora?.slice(0,5)}` : ''}
                </p>
              </div>
              <ChevronRight size={12} className="text-muted-foreground self-center group-hover:text-violet-500 transition-colors" />
            </div>
          </Link>
        ) : null}

        {remediosComHorario.slice(0, 2).map((m: any) => (
          <Link key={m.id} href="/grow/saude/remedios" className="group block p-3 rounded-xl bg-muted/40 border border-border/40 hover:border-violet-300 dark:hover:border-violet-800 transition-all">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-rose-100 dark:bg-rose-950/40">
                <Pill size={14} className="text-rose-600 dark:text-rose-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-foreground truncate">{m.nome} {m.dosagem || ''}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {m.horarios?.map((h: string) => h.slice(0,5)).join(', ')}
                  {m.estoque_atual != null && m.estoque_atual <= (m.estoque_alerta || 5) && (
                    <> · <span className="text-amber-600 dark:text-amber-400 font-semibold">⚠ {m.estoque_atual} restantes</span></>
                  )}
                </p>
              </div>
              <ChevronRight size={12} className="text-muted-foreground self-center group-hover:text-violet-500 transition-colors" />
            </div>
          </Link>
        ))}

        {!proximaConsulta && remediosComHorario.length === 0 && (
          <div className="rounded-xl p-4 text-center bg-muted/30 border border-dashed border-border/60">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Nenhum compromisso agendado.
            </p>
            <div className="flex gap-2 justify-center mt-2">
              <Link href="/grow/saude/consultas" className="text-[10px] font-semibold text-violet-600 hover:underline">+ Consulta</Link>
              <span className="text-[10px] text-muted-foreground">·</span>
              <Link href="/grow/saude/remedios" className="text-[10px] font-semibold text-violet-600 hover:underline">+ Remédio</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// QUICK ACTION
// ═══════════════════════════════════════════════════════════════════
function QuickAction({ icon: Icon, label, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-foreground transition-all
        border border-border/40 backdrop-blur-xl hover:border-violet-300 dark:hover:border-violet-800 hover:scale-[1.02] active:scale-95"
      style={{ background: 'hsl(var(--bg-card) / 0.5)' }}
    >
      <Icon size={13} className="text-violet-600 dark:text-violet-400" /> {label}
    </button>
  );
}

function QuickActionLink({ icon: Icon, label, href }: any) {
  return (
    <Link
      href={href}
      className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-foreground transition-all
        border border-border/40 backdrop-blur-xl hover:border-violet-300 dark:hover:border-violet-800 hover:scale-[1.02] active:scale-95"
      style={{ background: 'hsl(var(--bg-card) / 0.5)' }}
    >
      <Icon size={13} className="text-violet-600 dark:text-violet-400" /> {label}
    </Link>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MODAL REGISTRAR PESO
// ═══════════════════════════════════════════════════════════════════
function ModalPeso({ phone, onClose, onSuccess }: { phone: string; onClose: () => void; onSuccess: () => void }) {
  const [peso, setPeso] = useState('');
  const [obs, setObs] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar() {
    setErro('');
    const val = parseFloat(peso.replace(',', '.'));
    if (!val || val <= 0 || val > 600) { setErro('Peso inválido.'); return; }
    setLoading(true);
    try {
      await api.saude.pesos.criar({ phone, peso_kg: val, observacao: obs.trim() || undefined });
      onSuccess();
    } catch (e: any) { setErro(e.message); } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm bg-card rounded-3xl shadow-2xl overflow-hidden border border-border animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-violet-100 dark:bg-violet-950/40">
              <Scale size={16} className="text-violet-600 dark:text-violet-400" />
            </div>
            <h2 className="text-base font-bold text-foreground">Registrar peso</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Peso de hoje</p>
            <div className="flex items-baseline justify-center gap-1.5">
              <input
                type="text"
                inputMode="decimal"
                value={peso}
                onChange={e => setPeso(e.target.value.replace(/[^\d.,]/g, ''))}
                placeholder="0,0"
                className="text-5xl font-bold text-foreground bg-transparent border-none outline-none text-center w-32 tabular"
                autoFocus
              />
              <span className="text-xl font-bold text-muted-foreground">kg</span>
            </div>
          </div>
          <input
            value={obs}
            onChange={e => setObs(e.target.value)}
            placeholder="Observação (opcional)"
            className="input"
            maxLength={100}
          />
          {erro && (
            <div className="rounded-xl p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-start gap-2">
              <AlertCircle size={13} className="text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-400">{erro}</p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
          <button onClick={salvar} disabled={loading || !peso}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Registrar
          </button>
        </div>
      </div>
    </div>
  );
}
