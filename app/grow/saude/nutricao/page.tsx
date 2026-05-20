'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import ModalRefeicao    from '@/components/saude/ModalRefeicao';
import ModalCalculadora from '@/components/saude/ModalCalculadora';
import {
  Apple, Sparkles, Loader2, Plus, Calculator, Droplets,
  Sun, Coffee, Cookie, UtensilsCrossed, Moon as MoonIcon,
  Trash2, ChevronRight, Flame, ArrowRight,
} from 'lucide-react';
import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const BRAND = '#7c3aed';

const COR_PROT = '#ec4899';
const COR_CARB = '#f59e0b';
const COR_GORD = '#10b981';
const COR_AGUA = '#06b6d4';

const ICONE_TIPO: Record<string, any> = {
  cafe:        Coffee,
  almoco:      UtensilsCrossed,
  lanche:      Cookie,
  jantar:      Sun,
  ceia:        MoonIcon,
  pre_treino:  Flame,
  pos_treino:  Flame,
  outro:       Apple,
};
const LABEL_TIPO: Record<string, string> = {
  cafe: 'Café', almoco: 'Almoço', lanche: 'Lanche',
  jantar: 'Jantar', ceia: 'Ceia', pre_treino: 'Pré-treino', pos_treino: 'Pós-treino', outro: 'Outro',
};

const SEVERIDADE_COR: Record<string, string> = {
  sucesso: '#22c55e',
  aviso:   '#f59e0b',
  info:    BRAND,
};

const fmtHora = (h?: string) => h ? h.slice(0, 5) : '';

export default function NutricaoPage() {
  const { phone, perfil } = useAuth();
  const [meta, setMeta]             = useState<any>(null);
  const [diagnostico, setDiag]      = useState<any[]>([]);
  const [macrosHoje, setMacrosHoje] = useState({ calorias: 0, proteinas_g: 0, carboidratos_g: 0, gorduras_g: 0 });
  const [refeicoes, setRefeicoes]   = useState<any[]>([]);
  const [agua, setAgua]             = useState<any[]>([]);
  const [perfilSaude, setPerfilSaude] = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [modalRefeicao, setModalRefeicao] = useState(false);
  const [modalCalc, setModalCalc]   = useState(false);
  const [adicionandoAgua, setAdicionandoAgua] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    if (!phone) return;
    try {
      const [diag, refs, ag, pSaude] = await Promise.all([
        api.saude.nutricao.diagnostico(phone),
        api.saude.refeicoes.listar(phone, 7),
        api.saude.agua.listar(phone, 7),
        api.saude.perfil.get(phone).catch(() => null),
      ]);
      setMacrosHoje(diag.macros_hoje);
      setMeta(diag.meta);
      setDiag(diag.diagnostico || []);
      setRefeicoes(refs || []);
      setAgua(ag || []);
      setPerfilSaude(pSaude || null);
    } catch (e) { console.warn('[nutricao]', e); }
    finally { setLoading(false); }
  }, [phone]);

  useEffect(() => { carregar(); }, [carregar]);

  const hojeStr = new Date().toISOString().slice(0, 10);
  const refeicoesHoje = useMemo(() => refeicoes.filter(r => r.data === hojeStr), [refeicoes, hojeStr]);

  const aguaHojeML = useMemo(() => agua.filter(a => a.data === hojeStr).reduce((s, a) => s + (a.ml || 0), 0), [agua, hojeStr]);
  const metaAguaML = meta?.agua_ml || 2000;

  // Calorias últimos 7 dias para o gráfico
  const calorias7d = useMemo(() => {
    const map: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      map[d] = 0;
    }
    refeicoes.forEach(r => {
      const cal = (r.refeicao_itens || []).reduce((s: number, i: any) => s + (parseFloat(i.calorias) || 0), 0);
      if (map[r.data] != null) map[r.data] += cal;
    });
    return Object.entries(map).map(([dia, cal]) => ({
      dia: new Date(dia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
      cal: Math.round(cal),
    }));
  }, [refeicoes]);

  async function adicionarAgua(ml: number) {
    if (!phone) return;
    setAdicionandoAgua(ml);
    try {
      await api.saude.agua.registrar({ phone, ml });
      carregar();
    } catch (e: any) { alert(e.message); }
    finally { setTimeout(() => setAdicionandoAgua(null), 250); }
  }

  async function deletarRefeicao(id: string) {
    if (!phone) return;
    if (!confirm('Excluir essa refeição?')) return;
    try {
      await api.saude.refeicoes.deletar(id, phone);
      carregar();
    } catch (e: any) { alert(e.message); }
  }

  // Calcula idade pra passar como inicial na calculadora
  const idadeUsuario = useMemo(() => {
    if (!perfilSaude?.data_nascimento) return null;
    const nasc = new Date(perfilSaude.data_nascimento);
    return Math.floor((Date.now() - nasc.getTime()) / (365.25 * 86400000));
  }, [perfilSaude]);

  if (loading) {
    return (
      <div className="card rounded-3xl p-16 flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-violet-600" />
      </div>
    );
  }

  const calPct = meta?.calorias ? Math.min(100, Math.round((macrosHoje.calorias / meta.calorias) * 100)) : 0;
  const proPct = meta?.proteinas_g ? Math.min(100, Math.round((macrosHoje.proteinas_g / meta.proteinas_g) * 100)) : 0;
  const carPct = meta?.carboidratos_g ? Math.min(100, Math.round((macrosHoje.carboidratos_g / meta.carboidratos_g) * 100)) : 0;
  const gorPct = meta?.gorduras_g ? Math.min(100, Math.round((macrosHoje.gorduras_g / meta.gorduras_g) * 100)) : 0;
  const aguaPct = metaAguaML ? Math.min(100, Math.round((aguaHojeML / metaAguaML) * 100)) : 0;

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-5">

      {/* HERO */}
      <div
        className="relative overflow-hidden rounded-3xl border border-border/40 backdrop-blur-xl p-6 sm:p-8 animate-fade-in"
        style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card) / 0.7) 0%, hsl(var(--bg-subtle) / 0.5) 100%)' }}
      >
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: 'radial-gradient(ellipse at top right, rgba(16,185,129,0.14) 0%, transparent 55%), radial-gradient(circle at bottom left, rgba(124,58,237,0.10) 0%, transparent 50%)' }} />
        <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/40 mb-3">
              <Sparkles size={11} className="text-emerald-600 dark:text-emerald-400" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Nutrição</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">Nutrição</h1>
            <p className="text-muted-foreground text-sm mt-2 max-w-md leading-relaxed">
              {meta
                ? <>Sua meta: <strong className="text-foreground tabular">{meta.calorias} kcal</strong> · {meta.proteinas_g}g P · {meta.carboidratos_g}g C · {meta.gorduras_g}g G</>
                : <>Calcule suas metas diárias com a IA da Sora a partir do seu perfil.</>
              }
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setModalCalc(true)}
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-sm font-bold border border-border/60 bg-card/60 backdrop-blur-xl hover:border-violet-300 dark:hover:border-violet-800 transition-all">
              <Calculator size={14} /> Calculadora
            </button>
            <button onClick={() => setModalRefeicao(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold shadow-lg shadow-violet-600/30">
              <Plus size={14} /> Nova refeição
            </button>
          </div>
        </div>
      </div>

      {/* Sem meta → CTA pra calculadora */}
      {!meta && (
        <div className="rounded-3xl border-2 border-dashed border-violet-300 dark:border-violet-800 p-6 sm:p-8 bg-violet-50/50 dark:bg-violet-950/20 animate-fade-in flex flex-col sm:flex-row items-start gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 bg-violet-100 dark:bg-violet-900/40">
            <Calculator size={22} className="text-violet-600 dark:text-violet-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-foreground">Configure suas metas em 30 segundos</h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              A Sora calcula TMB, TDEE e divisão de macros baseado no seu perfil (peso, altura, idade, objetivo).
              {' '}Sem isso, o diagnóstico não fica preciso.
            </p>
            <button onClick={() => setModalCalc(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 mt-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold">
              <Calculator size={13} /> Abrir calculadora
            </button>
          </div>
        </div>
      )}

      {/* MACROS DO DIA — 4 rings */}
      {meta && (
        <div className="rounded-3xl border border-border/40 backdrop-blur-xl p-5 sm:p-6 animate-fade-in"
             style={{ background: 'hsl(var(--bg-card) / 0.5)', animationDelay: '60ms' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Macros de hoje</p>
              <p className="text-base font-bold text-foreground">{Math.round(macrosHoje.calorias)} / {meta.calorias} kcal</p>
            </div>
            <div className="text-[10px] font-bold tabular text-muted-foreground">{calPct}%</div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <RingMacro pct={calPct} cor={BRAND}     label="Calorias" valor={Math.round(macrosHoje.calorias)} meta={meta.calorias} unit="kcal" />
            <RingMacro pct={proPct} cor={COR_PROT}  label="Proteína" valor={Math.round(macrosHoje.proteinas_g)} meta={meta.proteinas_g} unit="g" />
            <RingMacro pct={carPct} cor={COR_CARB}  label="Carbos"   valor={Math.round(macrosHoje.carboidratos_g)} meta={meta.carboidratos_g} unit="g" />
            <RingMacro pct={gorPct} cor={COR_GORD}  label="Gordura"  valor={Math.round(macrosHoje.gorduras_g)} meta={meta.gorduras_g} unit="g" />
          </div>
        </div>
      )}

      {/* DIAGNÓSTICO */}
      {diagnostico.length > 0 && (
        <div className="space-y-2 animate-fade-in" style={{ animationDelay: '120ms' }}>
          {diagnostico.map((d, i) => (
            <div key={i}
                 className="flex items-start gap-3 p-4 rounded-2xl border backdrop-blur-xl"
                 style={{
                   background: `${SEVERIDADE_COR[d.severidade]}10`,
                   borderColor: `${SEVERIDADE_COR[d.severidade]}40`,
                 }}>
              <span className="text-2xl flex-shrink-0">{d.emoji}</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">{d.titulo}</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{d.texto}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AGUA + GRÁFICO CALORIAS 7d */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 animate-fade-in" style={{ animationDelay: '180ms' }}>

        {/* AGUA */}
        <div className="lg:col-span-2 rounded-2xl border border-border/40 backdrop-blur-xl p-5"
             style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Hidratação</p>
              <p className="text-base font-bold text-foreground">Água hoje</p>
            </div>
            <Droplets size={20} style={{ color: COR_AGUA }} />
          </div>

          <div className="flex items-baseline gap-1 tabular tracking-tight">
            <span className="text-3xl font-bold" style={{ color: COR_AGUA }}>{(aguaHojeML / 1000).toFixed(2)}</span>
            <span className="text-sm text-muted-foreground font-medium">L</span>
            <span className="text-xs text-muted-foreground ml-2">de {(metaAguaML / 1000).toFixed(1)}L</span>
          </div>

          <div className="relative h-2.5 rounded-full bg-muted overflow-hidden mt-3">
            <div
              className="absolute inset-y-0 left-0 transition-all duration-700 ease-out rounded-full"
              style={{
                width: `${aguaPct}%`,
                background: `linear-gradient(90deg, ${COR_AGUA} 0%, #0891b2 100%)`,
                boxShadow: `0 0 14px ${COR_AGUA}66`,
              }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4">
            {[200, 300, 500].map(ml => (
              <button
                key={ml}
                onClick={() => adicionarAgua(ml)}
                disabled={adicionandoAgua === ml}
                className={`relative px-2 py-2 rounded-lg text-[11px] font-bold transition-all border ${
                  adicionandoAgua === ml
                    ? 'scale-95 bg-cyan-50 dark:bg-cyan-950/40 border-cyan-300'
                    : 'bg-muted/30 border-border/40 hover:border-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/30'
                }`}
              >
                <Plus size={10} className="inline mr-0.5" /> {ml}ml
              </button>
            ))}
          </div>
        </div>

        {/* GRÁFICO CALORIAS 7d */}
        <div className="lg:col-span-3 rounded-2xl border border-border/40 backdrop-blur-xl p-5"
             style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Calorias últimos 7 dias</p>
              <p className="text-base font-bold text-foreground">
                Média: {Math.round(calorias7d.reduce((s, d) => s + d.cal, 0) / 7)} kcal/dia
              </p>
            </div>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={calorias7d} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="calGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRAND} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={36} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }}
                         formatter={(v: any) => [`${v} kcal`, 'Calorias']} />
                <Area type="monotone" dataKey="cal" stroke={BRAND} strokeWidth={2.5} fill="url(#calGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* REFEIÇÕES DE HOJE */}
      <div className="rounded-3xl border border-border/40 backdrop-blur-xl p-5 sm:p-6 animate-fade-in"
           style={{ background: 'hsl(var(--bg-card) / 0.5)', animationDelay: '240ms' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Refeições de hoje</p>
            <p className="text-base font-bold text-foreground">{refeicoesHoje.length} registrada{refeicoesHoje.length === 1 ? '' : 's'}</p>
          </div>
          <button onClick={() => setModalRefeicao(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:gap-2 transition-all">
            <Plus size={12} /> Adicionar
          </button>
        </div>

        {refeicoesHoje.length === 0 ? (
          <div className="rounded-2xl py-10 text-center bg-muted/20 border border-dashed border-border/60">
            <Apple size={20} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma refeição registrada hoje.</p>
            <button onClick={() => setModalRefeicao(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 mt-3 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700">
              <Sparkles size={11} /> Registrar com IA
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {refeicoesHoje.map(r => <CardRefeicao key={r.id} refeicao={r} onDelete={() => deletarRefeicao(r.id)} />)}
          </div>
        )}
      </div>

      {/* HISTÓRICO 7 DIAS (refeições anteriores) */}
      {refeicoes.length > refeicoesHoje.length && (
        <div className="rounded-3xl border border-border/40 backdrop-blur-xl p-5 sm:p-6 animate-fade-in"
             style={{ background: 'hsl(var(--bg-card) / 0.5)', animationDelay: '300ms' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Histórico recente</p>
          <div className="space-y-2">
            {refeicoes.filter(r => r.data !== hojeStr).slice(0, 6).map(r => (
              <CardRefeicao key={r.id} refeicao={r} mostrarData onDelete={() => deletarRefeicao(r.id)} />
            ))}
          </div>
        </div>
      )}

      {modalRefeicao && phone && (
        <ModalRefeicao
          phone={phone}
          onClose={() => setModalRefeicao(false)}
          onSuccess={() => { carregar(); setModalRefeicao(false); }}
        />
      )}
      {modalCalc && phone && (
        <ModalCalculadora
          phone={phone}
          inicial={{
            altura_cm: perfilSaude?.altura_cm,
            sexo:      perfilSaude?.sexo,
            idade:     idadeUsuario,
            nivel_atividade: perfilSaude?.nivel_atividade,
            objetivo:  perfilSaude?.objetivo,
            tipo_dieta: perfilSaude?.tipo_dieta,
          }}
          onClose={() => setModalCalc(false)}
          onSuccess={() => { carregar(); setModalCalc(false); }}
        />
      )}
    </div>
  );
}

// ─── RING DE MACRO ─────────────────────────────────────────────────
function RingMacro({ pct, cor, label, valor, meta, unit }: any) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-20 h-20 sm:w-24 sm:h-24">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="72%" outerRadius="100%" data={[{ pct: Math.min(100, pct) }]} startAngle={90} endAngle={-270}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="pct" fill={cor} cornerRadius={8} background={{ fill: 'hsl(var(--muted))' }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-bold tabular" style={{ color: cor }}>{pct}%</span>
        </div>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-2">{label}</p>
      <p className="text-[10px] text-foreground tabular font-semibold">{valor}<span className="text-muted-foreground">/{meta || '—'}{unit}</span></p>
    </div>
  );
}

// ─── CARD DE REFEIÇÃO ──────────────────────────────────────────────
function CardRefeicao({ refeicao, mostrarData, onDelete }: any) {
  const Icon = ICONE_TIPO[refeicao.tipo] || Apple;
  const total = (refeicao.refeicao_itens || []).reduce((acc: any, i: any) => ({
    calorias:    acc.calorias    + (parseFloat(i.calorias) || 0),
    proteinas:   acc.proteinas   + (parseFloat(i.proteinas_g) || 0),
    carbos:      acc.carbos      + (parseFloat(i.carboidratos_g) || 0),
    gorduras:    acc.gorduras    + (parseFloat(i.gorduras_g) || 0),
  }), { calorias: 0, proteinas: 0, carbos: 0, gorduras: 0 });

  return (
    <div className="group flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/40 hover:border-violet-300 dark:hover:border-violet-800 transition-all">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-violet-100 dark:bg-violet-950/40">
        <Icon size={16} className="text-violet-600 dark:text-violet-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-foreground">
            {LABEL_TIPO[refeicao.tipo] || 'Refeição'}
            {mostrarData && <span className="text-[10px] text-muted-foreground font-normal ml-2">· {new Date(refeicao.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}</span>}
            {refeicao.hora && <span className="text-[10px] text-muted-foreground font-normal ml-2">{fmtHora(refeicao.hora)}</span>}
          </p>
          <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40">
            <Trash2 size={11} className="text-red-500" />
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
          {(refeicao.refeicao_itens || []).map((i: any) => i.nome).join(' · ')}
        </p>
        <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
          <span className="text-xs font-bold tabular text-foreground">{Math.round(total.calorias)} kcal</span>
          <span className="text-[10px] tabular"><strong style={{ color: COR_PROT }}>{Math.round(total.proteinas)}g</strong> P</span>
          <span className="text-[10px] tabular"><strong style={{ color: COR_CARB }}>{Math.round(total.carbos)}g</strong> C</span>
          <span className="text-[10px] tabular"><strong style={{ color: COR_GORD }}>{Math.round(total.gorduras)}g</strong> G</span>
        </div>
      </div>
    </div>
  );
}
