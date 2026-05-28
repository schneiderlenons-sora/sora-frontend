'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
  Heart, Sparkles, Loader2, Check, Smile, Plus, TrendingUp,
  Moon, Zap, X,
} from 'lucide-react';
import GrowHero from '@/components/grow/GrowHero';
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis, XAxis, CartesianGrid } from 'recharts';

const BRAND = '#7c3aed';
const HUMOR_COR = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#7c3aed']; // 1-5
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

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-6">
      <GrowHero
        badge="Bem-estar"
        badgeColor="#db2777"
        badgeBgClass="bg-pink-100 dark:bg-pink-950/40"
        haloRgba="rgba(236,72,153,0.12)"
        titulo="Bem-estar"
        subtitulo="Como você está hoje? Registrar o humor te ajuda a notar padrões."
      />

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
            <div className="card rounded-3xl p-6 animate-fade-in" style={{ animationDelay: '60ms' }}>
              <div className="flex items-center gap-4">
                <div className="text-5xl">{HUMOR_EMOJI[registroHoje.humor]}</div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Hoje</p>
                  <p className="text-xl font-bold text-foreground">{HUMOR_LABEL[registroHoje.humor]} ({registroHoje.humor}/5)</p>
                  {registroHoje.nota && <p className="text-sm text-muted-foreground mt-1">{registroHoje.nota}</p>}
                </div>
                <button onClick={() => setModalOpen(true)} className="btn-ghost px-3 py-2 text-xs">Atualizar</button>
              </div>
            </div>
          )}

          {/* STATS */}
          <div className="grid grid-cols-3 gap-4 animate-fade-in" style={{ animationDelay: '120ms' }}>
            <StatBox icon={TrendingUp} label="Humor médio (30d)" value={humorMedio ? `${humorMedio}/5` : '—'} cor={BRAND} />
            <StatBox icon={Smile} label="Dias bons (30d)" value={String(diasBons)} cor="#22c55e" />
            <StatBox icon={Heart} label="Check-ins" value={String(registros.length)} cor="#ec4899" />
          </div>

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

          {registros.length === 0 && (
            <div className="card rounded-3xl py-16 flex flex-col items-center text-center px-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                   style={{ background: `${BRAND}22` }}>
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
          className="flex flex-col items-center gap-1 p-4 rounded-2xl transition-all border bg-muted/30 border-border/60 hover:border-violet-300 dark:hover:border-violet-800 hover:scale-105 active:scale-95"
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
                    humor === h ? 'scale-110 ring-2 ring-violet-500 bg-violet-50 dark:bg-violet-950/40' : 'bg-muted/30 hover:bg-muted/60'
                  }`}>
                  <span className="text-2xl">{HUMOR_EMOJI[h]}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1"><Zap size={11} /> Energia</label>
            <input type="range" min={1} max={5} value={energia} onChange={e => setEnergia(parseInt(e.target.value))} className="w-full accent-violet-600" />
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
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
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
    <div className="card rounded-2xl p-4">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2" style={{ background: `${cor}18` }}>
        <Icon size={16} style={{ color: cor }} />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-xl font-bold tabular tracking-tight mt-0.5" style={{ color: cor }}>{value}</p>
    </div>
  );
}
