'use client';

import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import SectionSkeleton from '@/components/ui/SectionSkeleton';
import { useApi } from '@/lib/useApi';
import {
  Heart, Sparkles, Loader2, Check, Smile, Plus, TrendingUp,
  Moon, Zap, X, CalendarDays, Pencil, Trash2,
} from 'lucide-react';
import { dataLocal, somarDias, alvoPadrao, rotuloDia, erroDaData, recentesPrimeiro, DIAS_PRA_TRAS, type Alvo } from '@/lib/humor';
import GrowHero from '@/components/grow/GrowHero';
import dynamic from 'next/dynamic';

// ⚠️ Skeletons com a MESMA ALTURA dos gráficos (h-64 e h-44): sem isso o
// conteúdo salta quando o chunk do recharts termina de carregar.
const GraficoHumor = dynamic(() => import('./GraficoHumor'), {
  ssr: false,
  loading: () => <div className="h-64 rounded-xl bg-muted/30 animate-pulse" />,
});
const GraficoSono = dynamic(() => import('./GraficoSono'), {
  ssr: false,
  loading: () => <div className="h-44 rounded-xl bg-muted/30 animate-pulse" />,
});

// Faixa ideal de sono (h) → cor de feedback
const corSono = (h: number) => h < 6 ? '#ef4444' : h < 7 ? '#f59e0b' : h <= 9 ? '#22c55e' : '#6366f1';
const labelSono = (h: number) => h < 6 ? 'Pouco' : h < 7 ? 'Ok' : h <= 9 ? 'Ideal' : 'Bastante';

const BRAND = 'hsl(var(--primary))';
const HUMOR_COR = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', 'hsl(var(--primary))']; // 1-5
const HUMOR_EMOJI = ['', '😔', '😕', '😐', '🙂', '😄'];
const HUMOR_LABEL = ['', 'Péssimo', 'Mal', 'Normal', 'Bem', 'Ótimo'];

export default function BemEstarPage() {
  const { phone } = useAuth();
  // Formulário: { registro } = editar aquele; { registro: null } = novo naquele dia.
  const [modal, setModal] = useState<{ registro: any | null; data: string } | null>(null);

  // ⚠️ Data do APARELHO (era toISOString = UTC: às 22h já marcava o dia seguinte).
  const hoje = dataLocal();
  const ontem = somarDias(hoje, -1);
  // Pedido da Tatiane: na madrugada o registro rápido vai pra ONTEM (e diz isso);
  // a pessoa troca com um toque. Derivado, sem efeito: nada pisca.
  const [alvoEscolhido, setAlvoEscolhido] = useState<Alvo | null>(null);
  const alvo: Alvo = alvoEscolhido ?? alvoPadrao();
  const dataAlvo = alvo === 'ontem' ? ontem : hoje;
  const madrugadaSugeriu = alvoEscolhido === null && alvo === 'ontem';

  // ── Humor via SWR: revisitar a tela é instantâneo (cache em memória). ──
  const { data: humorData, mutate: mHumor } = useApi(phone ? `bem:humor:${phone}` : null, () => api.grow.humor.listar(phone, 30));
  const registros: any[] = useMemo(() => (humorData as any) ?? [], [humorData]);
  const loading = humorData === undefined;
  const carregar = useCallback(() => mHumor(), [mHumor]);

  const registroAlvo = useMemo(() => registros.find(r => r.data === dataAlvo), [registros, dataAlvo]);
  const abrirDia = (data: string) => setModal({ registro: registros.find(r => r.data === data) || null, data });
  const humorMedio = useMemo(() => registros.length
    ? (registros.reduce((s, r) => s + r.humor, 0) / registros.length).toFixed(1)
    : null,
    [registros]
  );
  const diasBons = useMemo(() => registros.filter(r => r.humor >= 4).length, [registros]);

  const dadosGrafico = useMemo(() => {
    return [...registros].sort((a, b) => a.data.localeCompare(b.data)).map(r => ({
      dia: r.data?.slice(5).split('-').reverse().join('/'),
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
    const barras = ord.slice(-14).map(r => ({ dia: r.data?.slice(5).split('-').reverse().join('/'), horas: Number(r.sono_horas) }));
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

  const seletor = <SeletorDia alvo={alvo} onMudar={setAlvoEscolhido} />;

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-6">
      <GrowHero
        badge="Bem-estar"
        titulo="Bem-estar"
        subtitulo="Como você está hoje? Registrar o humor te ajuda a notar padrões."
      >
        <button onClick={() => abrirDia(dataAlvo)}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:opacity-90 text-white text-sm font-bold shadow-lg shadow-primary/25 transition-all active:scale-[0.98]">
          <Plus size={16} /> Registrar
        </button>
      </GrowHero>

      {loading ? (
        <SectionSkeleton />
      ) : (
        <>
          {/* CHECK-IN (hoje, ou ontem na madrugada) */}
          {!registroAlvo ? (
            <div className="card rounded-3xl p-6 sm:p-8 animate-fade-in" style={{ animationDelay: '60ms' }}>
              <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
                <h2 className="text-lg font-bold text-foreground">{alvo === 'ontem' ? 'Como foi o seu dia ontem?' : 'Como você está hoje?'}</h2>
                {seletor}
              </div>
              <p className="text-sm text-muted-foreground mb-5">
                {madrugadaSugeriu
                  ? <>Já passou da meia-noite, então vamos registrar como <b className="text-foreground">ontem ({ontem.slice(8, 10)}/{ontem.slice(5, 7)})</b>. Se for sobre hoje, toque em Hoje.</>
                  : 'Um clique e a Sora aprende mais sobre você.'}
              </p>
              <CheckinHumor
                phone={phone!}
                data={dataAlvo}
                onOtimista={(humor) => mHumor(
                  (cur: any) => [
                    ...((cur || []).filter((r: any) => r.data !== dataAlvo)),
                    { data: dataAlvo, humor, energia: null, nota: null },
                  ],
                  { revalidate: false, populateCache: true },
                )}
                onSuccess={() => carregar()}
              />
            </div>
          ) : (
            <div className="card rounded-3xl p-5 sm:p-6 animate-fade-in" style={{ animationDelay: '60ms' }}>
              <div className="flex items-center gap-4">
                <div className="text-4xl sm:text-5xl flex-shrink-0">{HUMOR_EMOJI[registroAlvo.humor]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{rotuloDia(registroAlvo.data, hoje)}</p>
                  <p className="text-lg sm:text-xl font-bold text-foreground">{HUMOR_LABEL[registroAlvo.humor]} ({registroAlvo.humor}/5)</p>
                  {registroAlvo.nota && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{registroAlvo.nota}</p>}
                </div>
                <button onClick={() => setModal({ registro: registroAlvo, data: registroAlvo.data })} aria-label="Editar este registro"
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted flex-shrink-0">
                  <Pencil size={16} />
                </button>
              </div>
              <div className="mt-3 flex justify-end">{seletor}</div>
            </div>
          )}

          {/* STATS */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4 animate-fade-in" style={{ animationDelay: '120ms' }}>
            <StatBox icon={TrendingUp} label="Humor médio (30d)" value={humorMedio ? `${humorMedio}/5` : '—'} cor={BRAND} />
            <StatBox icon={Smile} label="Dias bons (30d)" value={String(diasBons)} cor="#22c55e" />
            <StatBox icon={Heart} label="Check-ins" value={String(registros.length)} cor="#ec4899" />
          </div>

          {/* SONO */}
          {registros.length > 0 && <SonoCard sono={sono} onAdd={() => abrirDia(dataAlvo)} />}

          {/* GRAFICO */}
          {dadosGrafico.length > 0 && (
            <div className="card rounded-3xl p-6 animate-fade-in" style={{ animationDelay: '180ms' }}>
              <h2 className="text-lg font-bold text-foreground mb-4">Tendência — últimos 30 dias</h2>
              <GraficoHumor data={dadosGrafico} cor={BRAND} />
            </div>
          )}

          {/* HISTÓRICO — corrigir o dia ou o que foi registrado */}
          {registros.length > 0 && (
            <HistoricoHumor registros={registros} hoje={hoje}
              onAbrir={(r) => setModal({ registro: r, data: r.data })}
              onOutroDia={() => setModal({ registro: null, data: somarDias(hoje, -1) })} />
          )}

          {/* MURAL DE GRATIDÃO */}
          {registros.length > 0 && <GratidaoMural entries={gratidaoEntries} onAdd={() => abrirDia(dataAlvo)} />}

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

      {modal && phone && (
        <ModalHumor
          key={`${modal.registro?.id || 'novo'}-${modal.data}`}
          phone={phone}
          registro={modal.registro}
          dataInicial={modal.data}
          registros={registros}
          hoje={hoje}
          onClose={() => setModal(null)}
          onSuccess={() => { carregar(); setModal(null); }}
        />
      )}
    </div>
  );
}

// Hoje | Ontem — de qual dia é o check-in rápido.
function SeletorDia({ alvo, onMudar }: { alvo: Alvo; onMudar: (a: Alvo) => void }) {
  return (
    <div className="inline-flex p-0.5 rounded-xl bg-muted/50" role="group" aria-label="Dia do registro">
      {(['ontem', 'hoje'] as const).map(a => (
        <button key={a} onClick={() => onMudar(a)} aria-pressed={alvo === a}
          className={`h-9 px-3 rounded-lg text-xs font-semibold transition-colors ${alvo === a ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
          {a === 'ontem' ? 'Ontem' : 'Hoje'}
        </button>
      ))}
    </div>
  );
}

function CheckinHumor({ phone, data, onOtimista, onSuccess }: {
  phone: string;
  data: string;
  onOtimista: (humor: number) => void;
  onSuccess: () => void;
}) {
  async function registrar(humor: number) {
    // Optimismo total — UI atualiza imediatamente, sem disable de botão.
    onOtimista(humor);
    try {
      await api.grow.humor.registrar({ phone, humor, data });
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

// ═══════════════════════════════════════════════════════════════════
// HISTÓRICO — os registros recentes; tocar abre pra corrigir (inclusive o dia)
// ═══════════════════════════════════════════════════════════════════
function HistoricoHumor({ registros, hoje, onAbrir, onOutroDia }: {
  registros: any[]; hoje: string; onAbrir: (r: any) => void; onOutroDia: () => void;
}) {
  const [todos, setTodos] = useState(false);
  const lista = recentesPrimeiro(registros);
  const mostra = todos ? lista : lista.slice(0, 7);
  return (
    <div className="card rounded-3xl p-5 sm:p-6 animate-fade-in" style={{ animationDelay: '200ms' }}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Seus registros</h2>
          <p className="text-xs text-muted-foreground">Toque num dia pra corrigir o humor ou a data.</p>
        </div>
        <button onClick={onOutroDia}
          className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-xs font-semibold text-foreground border border-border/60 hover:bg-muted flex-shrink-0">
          <CalendarDays size={14} aria-hidden /> Outro dia
        </button>
      </div>
      <ul className="divide-y divide-border/50">
        {mostra.map((r) => (
          <li key={r.id || r.data}>
            <button onClick={() => r.id && onAbrir(r)} disabled={!r.id}
              className="w-full flex items-center gap-3 py-2.5 text-left rounded-lg hover:bg-muted/40 px-1 -mx-1 disabled:opacity-60">
              <span className="text-2xl flex-shrink-0" aria-hidden>{HUMOR_EMOJI[r.humor]}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-foreground">
                  {rotuloDia(r.data, hoje)} <span className="font-normal text-muted-foreground">· {HUMOR_LABEL[r.humor]}</span>
                </span>
                {(r.nota || r.sono_horas != null || r.energia) && (
                  <span className="block text-xs text-muted-foreground truncate">
                    {[r.energia ? `energia ${r.energia}/5` : null, r.sono_horas != null ? `${Number(r.sono_horas).toFixed(1)}h de sono` : null, r.nota].filter(Boolean).join(' · ')}
                  </span>
                )}
              </span>
              <Pencil size={14} className="text-muted-foreground flex-shrink-0" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {lista.length > 7 && (
        <button onClick={() => setTodos(v => !v)} className="mt-2 h-10 px-2 text-xs font-semibold text-primary hover:underline">
          {todos ? 'Mostrar menos' : `Ver todos (${lista.length})`}
        </button>
      )}
    </div>
  );
}

function ModalHumor({ phone, registro, dataInicial, registros, hoje, onClose, onSuccess }: {
  phone: string; registro: any | null; dataInicial: string; registros: any[]; hoje: string;
  onClose: () => void; onSuccess: () => void;
}) {
  const [data, setData]     = useState<string>(registro?.data || dataInicial);
  const [humor, setHumor]   = useState<number>(registro?.humor || 3);
  const [nota, setNota]     = useState(registro?.nota || '');
  // Registro novo nasce com energia 3; num registro que NÃO tinha energia, ela
  // só é gravada se a pessoa mexer na barra (editar a data não inventa energia).
  const [energia, setEnergia] = useState<number | null>(registro ? (registro.energia ?? null) : 3);
  const [sono, setSono]     = useState(registro?.sono_horas?.toString() || '');
  const [gratidao, setGratidao] = useState<string[]>(() => {
    const g = Array.isArray(registro?.gratidao) ? registro.gratidao.slice(0, 3) : [];
    return [...g, '', '', ''].slice(0, 3);
  });
  const [loading, setLoading] = useState(false);
  const [confirmarApagar, setConfirmarApagar] = useState(false);
  const [erro, setErro] = useState('');

  const erroData = erroDaData(data, hoje);
  // Outro registro no dia escolhido (o próprio não conta).
  const outro = registros.find(r => r.data === data && r.id !== registro?.id);
  const bloqueado = !!erroData || (!!registro && !!outro);

  async function salvar() {
    if (bloqueado) return;
    setErro(''); setLoading(true);
    const corpo = {
      data, humor, nota: nota.trim() || null,
      energia, sono_horas: sono ? parseFloat(sono.replace(',', '.')) : null,
      gratidao: gratidao.filter(g => g.trim()),
    };
    try {
      if (registro?.id) await api.grow.humor.editar(registro.id, corpo);
      else await api.grow.humor.registrar({ phone, ...corpo, nota: corpo.nota || undefined, sono_horas: corpo.sono_horas ?? undefined, energia: corpo.energia ?? undefined });
      onSuccess();
    } catch (e: any) { setErro(e.message); } finally { setLoading(false); }
  }

  async function apagar() {
    if (!registro?.id) return;
    setLoading(true);
    try { await api.grow.humor.apagar(registro.id); onSuccess(); }
    catch (e: any) { setErro(e.message); setConfirmarApagar(false); setLoading(false); }
  }

  const ontem = somarDias(hoje, -1);
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div role="dialog" aria-modal="true" aria-label={registro ? 'Editar registro de humor' : 'Registrar humor'}
           className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden border border-border animate-fade-in max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground">{registro ? 'Editar registro' : 'Como foi seu dia?'}</h2>
          <button onClick={onClose} aria-label="Fechar" className="p-2 rounded-xl hover:bg-muted"><X size={18} /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
          {/* DIA — o pedido: registrar e corrigir a data */}
          <div>
            <label htmlFor="humor-dia" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1"><CalendarDays size={11} /> Dia</label>
            <div className="flex items-center gap-2">
              <input id="humor-dia" type="date" value={data} max={hoje} min={somarDias(hoje, -DIAS_PRA_TRAS)}
                     onChange={e => { setData(e.target.value); setErro(''); }} className="input flex-1 min-w-0" />
              {[['Ontem', ontem], ['Hoje', hoje]].map(([l, d]) => (
                <button key={l} type="button" onClick={() => { setData(d); setErro(''); }} aria-pressed={data === d}
                  className={`h-11 px-3 rounded-xl text-xs font-semibold border transition-colors flex-shrink-0 ${data === d ? 'border-primary bg-primary/10 text-foreground' : 'border-border/60 text-muted-foreground hover:text-foreground'}`}>
                  {l}
                </button>
              ))}
            </div>
            {erroData ? <p className="mt-1.5 text-xs text-red-600" role="alert">{erroData}</p>
              : outro && registro ? <p className="mt-1.5 text-xs text-red-600" role="alert">Esse dia já tem outro registro ({HUMOR_EMOJI[outro.humor]} {HUMOR_LABEL[outro.humor]}). Edite ou apague aquele primeiro.</p>
              : outro ? <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-500">Esse dia já tem um registro ({HUMOR_EMOJI[outro.humor]} {HUMOR_LABEL[outro.humor]}). Salvar substitui.</p>
              : null}
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">Humor</label>
            <div className="grid grid-cols-5 gap-1.5">
              {[1,2,3,4,5].map(h => (
                <button key={h} onClick={() => setHumor(h)} aria-label={HUMOR_LABEL[h]} aria-pressed={humor === h}
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
            <input type="range" min={1} max={5} value={energia ?? 3} onChange={e => setEnergia(parseInt(e.target.value))} className="w-full accent-primary" aria-label="Energia" />
            <p className="text-xs text-muted-foreground text-center mt-1 tabular">{energia == null ? 'não informada' : `${energia}/5`}</p>
          </div>
          <div>
            <label htmlFor="humor-sono" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1"><Moon size={11} /> Horas de sono</label>
            <input id="humor-sono" type="text" inputMode="decimal" value={sono} onChange={e => setSono(e.target.value)} placeholder="8" className="input" />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">3 coisas pelas quais você é grato</label>
            <div className="space-y-2">
              {gratidao.map((g, i) => (
                <input key={i} value={g} onChange={e => {
                  const novo = [...gratidao]; novo[i] = e.target.value; setGratidao(novo);
                }} placeholder={`${i + 1}.`} className="input" maxLength={80} aria-label={`Gratidão ${i + 1}`} />
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="humor-nota" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Como foi o dia? <span className="text-muted-foreground/60 normal-case font-normal">(opcional)</span></label>
            <textarea id="humor-nota" value={nota} onChange={e => setNota(e.target.value)} rows={2} placeholder="Algo marcante..." className="input" maxLength={400} />
          </div>
          {erro && <p className="text-xs text-red-600" role="alert">{erro}</p>}
          {registro?.id && (confirmarApagar ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2.5" role="alert">
              <p className="text-sm text-foreground flex-1 min-w-[10rem]">Apagar o registro de {rotuloDia(registro.data, hoje).toLowerCase()}?</p>
              <button onClick={() => setConfirmarApagar(false)} className="h-10 px-3 rounded-xl text-sm font-semibold text-foreground hover:bg-muted">Cancelar</button>
              <button onClick={() => void apagar()} disabled={loading} className="h-10 px-3.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60">Apagar</button>
            </div>
          ) : (
            <button onClick={() => setConfirmarApagar(true)} className="inline-flex items-center gap-1.5 h-10 px-2 -ml-2 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-500/10">
              <Trash2 size={14} aria-hidden /> Apagar este registro
            </button>
          ))}
        </div>
        <div className="shrink-0 flex justify-end gap-2 px-6 py-4 border-t border-border bg-card">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
          <button onClick={() => void salvar()} disabled={loading || bloqueado}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {registro ? 'Salvar' : 'Registrar'}
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
          <GraficoSono data={barras} />
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
