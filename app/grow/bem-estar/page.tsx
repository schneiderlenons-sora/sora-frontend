'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
  Heart, Sparkles, Loader2, Check, Smile, Plus, TrendingUp,
  Moon, Zap, X,
} from 'lucide-react';
import GrowHero from '@/components/grow/GrowHero';
import {
  LineChart, Line, BarChart, Bar, Cell, ReferenceArea,
  ResponsiveContainer, Tooltip, YAxis, XAxis, CartesianGrid,
} from 'recharts';

// Faixa ideal de sono (h) → cor de feedback
const corSono = (h: number) => h < 6 ? '#ef4444' : h < 7 ? '#f59e0b' : h <= 9 ? '#22c55e' : '#6366f1';
const labelSono = (h: number) => h < 6 ? 'Pouco' : h < 7 ? 'Ok' : h <= 9 ? 'Ideal' : 'Bastante';

const BRAND = 'hsl(var(--primary))';
const HUMOR_COR = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', 'hsl(var(--primary))']; // 1-5
const HUMOR_EMOJI = ['', '😔', '😕', '😐', '🙂', '😄'];
const HUMOR_LABEL = ['', 'Péssimo', 'Mal', 'Normal', 'Bem', 'Ótimo'];

export default function BemEstarPage() {
  const { phone } = useAuth();
  const [registros, setRegistros] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const hoje = new Date().toISOString().slice(0, 10);

  // Padrão SWR-style: 1ª chamada pisca loader, subsequentes (após ações
  // otimistas) revalidam silenciosamente em background sem piscar nada.
  const carregar = useCallback(async (silent = false) => {
    if (!phone) return;
    if (!silent) setLoading(true);
    try {
      const r = await api.grow.humor.listar(phone, 30);
      setRegistros(r || []);
    } finally { if (!silent) setLoading(false); }
  }, [phone]);

  useEffect(() => { carregar(); }, [carregar]);

  const registroHoje = useMemo(() => registros.find(r => r.data === hoje), [registros, hoje]);
  const humorMedio = useMemo(() => registros.length
    ? (registros.reduce((s, r) => s + r.humor, 0) / registros.length).toFixed(1)
    : null,
    [registros]
  );
  const diasBons = useMemo(() => registros.filter(r => r.humor >= 4).length, [registros]);

  const dadosGrafico = useMemo(() => {
    return registros.map(r => ({
      dia: r.data?.slice(5).replace('-', '/'),
      humor: r.humor,
      energia: r.energia,
    }));
  }, [registros]);

  // ── SONO (dado já salvo no check-in, agora com superfície) ──────
  const sono = useMemo(() => {
    const com = registros.filter(r => r.sono_horas != null);
    const ord = [...com].sort((a, b) => a.data.localeCompare(b.data));
    const ult7 = ord.slice(-7);
    const media7 = ult7.length ? ult7.reduce((s, r) => s + Number(r.sono_horas), 0) / ult7.length : null;
    const ultimo = ord[ord.length - 1] || null;
    const barras = ord.slice(-14).map(r => ({ dia: r.data?.slice(5).replace('-', '/'), horas: Number(r.sono_horas) }));
    return { temDados: com.length > 0, ultimo, media7, barras };
  }, [registros]);

  // ── GRATIDÃO (mural — mais recentes primeiro) ──────────────────
  const gratidaoEntries = useMemo(() =>
    [...registros]
      .filter(r => Array.isArray(r.gratidao) && r.gratidao.filter((g: string) => g?.trim()).length > 0)
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 9),
    [registros]
  );

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-6">
      <GrowHero
        badge="Bem-estar"
        titulo="Bem-estar"
        subtitulo="Como você está hoje? Registrar o humor te ajuda a notar padrões."
      >
        <button onClick={() => setModalOpen(true)}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:opacity-90 text-white text-sm font-bold shadow-lg shadow-primary/25 transition-all active:scale-[0.98]">
          <Plus size={16} /> Registrar
        </button>
      </GrowHero>

      {loading ? (
        <div className="card rounded-3xl p-12 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin" style={{ color: BRAND }} />
        </div>
      ) : (
        <>
          {/* CHECKIN DO DIA */}
          {!registroHoje ? (
            <div className="card rounded-3xl p-6 sm:p-8 animate-fade-in" style={{ animationDelay: '60ms' }}>
              <h2 className="text-lg font-bold text-foreground mb-1">Como você está hoje?</h2>
              <p className="text-sm text-muted-foreground mb-5">Um clique e a Sora aprende mais sobre você.</p>
              <CheckinHumor
                phone={phone!}
                onOtimista={(humor) => setRegistros(prev => [
                  { data: hoje, humor, energia: null, nota: null },
                  ...prev.filter(r => r.data !== hoje),
                ])}
                onSuccess={() => carregar(true)}
              />
            </div>
          ) : (
            <div className="card rounded-3xl p-5 sm:p-6 animate-fade-in" style={{ animationDelay: '60ms' }}>
              <div className="flex items-center gap-4">
                <div className="text-4xl sm:text-5xl flex-shrink-0">{HUMOR_EMOJI[registroHoje.humor]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Hoje</p>
                  <p className="text-lg sm:text-xl font-bold text-foreground">{HUMOR_LABEL[registroHoje.humor]} ({registroHoje.humor}/5)</p>
                  {registroHoje.nota && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{registroHoje.nota}</p>}
                </div>
              </div>
            </div>
          )}

          {/* STATS */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4 animate-fade-in" style={{ animationDelay: '120ms' }}>
            <StatBox icon={TrendingUp} label="Humor médio (30d)" value={humorMedio ? `${humorMedio}/5` : '—'} cor={BRAND} />
            <StatBox icon={Smile} label="Dias bons (30d)" value={String(diasBons)} cor="#22c55e" />
            <StatBox icon={Heart} label="Check-ins" value={String(registros.length)} cor="#ec4899" />
          </div>

          {/* SONO */}
          {registros.length > 0 && <SonoCard sono={sono} onAdd={() => setModalOpen(true)} />}

          {/* GRAFICO */}
          {dadosGrafico.length > 0 && (
            <div className="card rounded-3xl p-6 animate-fade-in" style={{ animationDelay: '180ms' }}>
              <h2 className="text-lg font-bold text-foreground mb-4">Tendência — últimos 30 dias</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dadosGrafico}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                    <YAxis domain={[1, 5]} stroke="hsl(var(--muted-foreground))" fontSize={10} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
                    <Line type="monotone" dataKey="humor" stroke={BRAND} strokeWidth={3} dot={{ fill: BRAND, r: 4 }} name="Humor" />
                    {dadosGrafico.some(d => d.energia) && (
                      <Line type="monotone" dataKey="energia" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 3 }} name="Energia" />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* MURAL DE GRATIDÃO */}
          {registros.length > 0 && <GratidaoMural entries={gratidaoEntries} onAdd={() => setModalOpen(true)} />}

          {registros.length === 0 && (
            <div className="card rounded-3xl py-16 flex flex-col items-center text-center px-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                   style={{ background: `color-mix(in srgb, ${BRAND} 13%, transparent)` }}>
                <Heart size={26} style={{ color: BRAND }} />
              </div>
              <p className="text-base font-bold text-foreground">Sem registros ainda</p>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
                Registre como você está se sentindo. A Sora vai te ajudar a notar padrões.
              </p>
            </div>
          )}
        </>
      )}

      {modalOpen && phone && (
        <ModalHumor
          phone={phone}
          atual={registroHoje}
          onClose={() => setModalOpen(false)}
          onSuccess={() => { carregar(true); setModalOpen(false); }}
        />
      )}
    </div>
  );
}

function CheckinHumor({ phone, onOtimista, onSuccess }: {
  phone: string;
  onOtimista: (humor: number) => void;
  onSuccess: () => void;
}) {
  async function registrar(humor: number) {
    // Optimismo total — UI atualiza imediatamente, sem disable de botão.
    onOtimista(humor);
    try {
      await api.grow.humor.registrar({ phone, humor });
      onSuccess(); // revalida em background
    } catch (e: any) {
      alert(e.message);
      onSuccess(); // reverte buscando do servidor
    }
  }

  return (
    <div className="grid grid-cols-5 gap-2">
      {[1,2,3,4,5].map(h => (
        <button
          key={h}
          onClick={() => registrar(h)}
          className="flex flex-col items-center gap-1 p-4 rounded-2xl transition-all border bg-muted/30 border-border/60 hover:border-primary/40 dark:hover:border-primary hover:scale-105 active:scale-95"
        >
          <span className="text-4xl">{HUMOR_EMOJI[h]}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{HUMOR_LABEL[h]}</span>
        </button>
      ))}
    </div>
  );
}

function ModalHumor({ phone, atual, onClose, onSuccess }: any) {
  const [humor, setHumor]   = useState<number>(atual?.humor || 3);
  const [nota, setNota]     = useState(atual?.nota || '');
  const [energia, setEnergia] = useState<number>(atual?.energia || 3);
  const [sono, setSono]     = useState(atual?.sono_horas?.toString() || '');
  const [gratidao, setGratidao] = useState<string[]>(atual?.gratidao || ['', '', '']);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar() {
    setErro(''); setLoading(true);
    try {
      await api.grow.humor.registrar({
        phone, humor, nota: nota.trim() || undefined,
        energia, sono_horas: sono ? parseFloat(sono) : undefined,
        gratidao: gratidao.filter(g => g.trim()),
      });
      onSuccess();
    } catch (e: any) { setErro(e.message); } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden border border-border animate-fade-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-base font-bold text-foreground">Como foi seu dia?</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">Humor</label>
            <div className="grid grid-cols-5 gap-1.5">
              {[1,2,3,4,5].map(h => (
                <button key={h} onClick={() => setHumor(h)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${
                    humor === h ? 'scale-110 ring-2 ring-primary bg-primary/10 dark:bg-primary/15' : 'bg-muted/30 hover:bg-muted/60'
                  }`}>
                  <span className="text-2xl">{HUMOR_EMOJI[h]}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1"><Zap size={11} /> Energia</label>
            <input type="range" min={1} max={5} value={energia} onChange={e => setEnergia(parseInt(e.target.value))} className="w-full accent-primary" />
            <p className="text-xs text-muted-foreground text-center mt-1 tabular">{energia}/5</p>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1"><Moon size={11} /> Horas de sono</label>
            <input type="number" step="0.5" min="0" max="24" value={sono} onChange={e => setSono(e.target.value)} placeholder="8" className="input" />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">3 coisas pelas quais você é grato hoje</label>
            <div className="space-y-2">
              {gratidao.map((g, i) => (
                <input key={i} value={g} onChange={e => {
                  const novo = [...gratidao]; novo[i] = e.target.value; setGratidao(novo);
                }} placeholder={`${i + 1}.`} className="input" maxLength={80} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Como foi o dia? <span className="text-muted-foreground/60 normal-case font-normal">(opcional)</span></label>
            <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2} placeholder="Algo marcante..." className="input" maxLength={400} />
          </div>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20 sticky bottom-0">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
          <button onClick={salvar} disabled={loading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Registrar
          </button>
        </div>
      </div>
    </div>
  );
}

function StatBox({ icon: Icon, label, value, cor }: any) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/40 backdrop-blur-xl p-3 sm:p-4"
         style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
      <div className="absolute inset-0 pointer-events-none opacity-40"
           style={{ background: `radial-gradient(circle at top right, color-mix(in srgb, ${cor} 14%, transparent) 0%, transparent 70%)` }} />
      <div className="relative">
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center mb-2" style={{ background: `color-mix(in srgb, ${cor} 10%, transparent)` }}>
          <Icon size={16} style={{ color: cor }} />
        </div>
        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider sm:tracking-widest text-muted-foreground leading-tight">{label}</p>
        <p className="text-lg sm:text-xl font-bold tabular tracking-tight mt-0.5" style={{ color: cor }}>{value}</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SONO — última noite + média 7d + barras com faixa ideal
// ═══════════════════════════════════════════════════════════════════
function SonoCard({ sono, onAdd }: { sono: any; onAdd: () => void }) {
  const { temDados, ultimo, media7, barras } = sono;
  const COR = '#6366f1';

  return (
    <div className="rounded-3xl border border-border/40 backdrop-blur-xl p-5 sm:p-6 animate-fade-in"
         style={{ animationDelay: '160ms', background: 'hsl(var(--bg-card) / 0.5)' }}>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `color-mix(in srgb, ${COR} 10%, transparent)` }}>
          <Moon size={16} style={{ color: COR }} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sono</p>
          <p className="text-sm font-bold text-foreground">Suas horas de descanso</p>
        </div>
        <button onClick={onAdd} aria-label="Registrar horas de sono"
          className="ml-auto w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-90 hover:brightness-110 outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
          style={{ background: `color-mix(in srgb, ${COR} 10%, transparent)`, color: COR }}>
          <Plus size={18} />
        </button>
      </div>

      {!temDados ? (
        <div className="rounded-2xl border border-dashed border-border/60 py-9 px-6 text-center bg-muted/10">
          <div className="text-3xl mb-2">😴</div>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
            Anote quantas horas você dormiu no check-in do dia pra acompanhar seu sono aqui.
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[190px_1fr] gap-5 lg:gap-6 items-center">
          {/* Resumo */}
          <div className="flex lg:flex-col gap-5 lg:gap-3">
            <div className="flex-1 lg:flex-none">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Última noite</p>
              <p className="text-4xl font-bold tabular tracking-tight mt-0.5 leading-none" style={{ color: corSono(Number(ultimo.sono_horas)) }}>
                {Number(ultimo.sono_horas).toFixed(1)}<span className="text-lg text-muted-foreground font-medium">h</span>
              </p>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mt-2"
                    style={{ background: `${corSono(Number(ultimo.sono_horas))}1A`, color: corSono(Number(ultimo.sono_horas)) }}>
                {labelSono(Number(ultimo.sono_horas))}
              </span>
            </div>
            <div className="flex-1 lg:flex-none lg:border-t lg:border-border/40 lg:pt-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Média 7 dias</p>
              <p className="text-2xl font-bold tabular tracking-tight text-foreground mt-0.5 leading-none">
                {media7 != null ? media7.toFixed(1) : '—'}<span className="text-sm text-muted-foreground font-medium">h</span>
              </p>
              <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#22c55e', opacity: 0.5 }} />
                Faixa ideal: 7–9h
              </p>
            </div>
          </div>

          {/* Barras com zona ideal */}
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barras} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} />
                <YAxis domain={[0, 12]} ticks={[0, 4, 8, 12]} stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} />
                <ReferenceArea y1={7} y2={9} fill="#22c55e" fillOpacity={0.10} />
                <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                         contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }}
                         formatter={(v: any) => [`${v}h`, 'Sono']} />
                <Bar dataKey="horas" radius={[4, 4, 0, 0]} maxBarSize={28}>
                  {barras.map((b: any, i: number) => <Cell key={i} fill={corSono(b.horas)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MURAL DE GRATIDÃO — cards com as coisas registradas, por dia
// ═══════════════════════════════════════════════════════════════════
function GratidaoMural({ entries, onAdd }: { entries: any[]; onAdd: () => void }) {
  const COR = '#f43f5e';
  return (
    <div className="animate-fade-in" style={{ animationDelay: '220ms' }}>
      <div className="flex items-center justify-between mb-3 px-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <span className="text-sm">🙏</span> Mural de gratidão
        </p>
        <button onClick={onAdd} aria-label="Registrar gratidão"
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-90 hover:brightness-110 outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
          style={{ background: `color-mix(in srgb, ${COR} 10%, transparent)`, color: COR }}>
          <Plus size={18} />
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/60 py-10 px-6 text-center bg-muted/10">
          <div className="text-4xl mb-3">🙏</div>
          <p className="text-base font-bold text-foreground">Nada registrado ainda</p>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto leading-relaxed">
            No check-in, anote 3 coisas pelas quais você é grato. Reler depois faz um bem danado.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {entries.map((e, i) => {
            const items = (e.gratidao || []).filter((g: string) => g?.trim());
            return (
              <div key={e.data + i}
                   className="relative overflow-hidden rounded-2xl border border-border/40 backdrop-blur-xl p-4"
                   style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
                <div className="absolute inset-0 pointer-events-none opacity-40"
                     style={{ background: `radial-gradient(circle at top right, color-mix(in srgb, ${COR} 9%, transparent) 0%, transparent 70%)` }} />
                <div className="relative">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: COR }}>
                    {new Date(e.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).replace(/\./g, '')}
                  </p>
                  <ul className="space-y-2">
                    {items.map((g: string, gi: number) => (
                      <li key={gi} className="flex items-start gap-2 text-sm text-foreground/90">
                        <Heart size={12} className="flex-shrink-0 mt-1" style={{ color: COR }} fill={COR} />
                        <span className="leading-snug">{g}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
