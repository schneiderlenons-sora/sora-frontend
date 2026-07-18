'use client';

import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { Plane, Plus, Loader2, MapPin, Wallet, CheckCircle2, X, Sparkles, Trash2 } from 'lucide-react';
import GrowHero from '@/components/grow/GrowHero';
import { Capa, Segmented, Campo, ModalShell, Vazio, ErroCard } from '@/components/grow/colecao';

const fmtBRL = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n || 0);
const fmtDia = (d?: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '') : '';

const ST_VIAGEM = [
  { value: 'planejando', label: 'Planejando', emoji: '📝', cor: '#f59e0b' },
  { value: 'confirmada', label: 'Confirmada', emoji: '🎟️', cor: '#0ea5e9' },
  { value: 'concluida',  label: 'Concluída',  emoji: '✅', cor: '#22c55e' },
] as const;
const stViagem = (s: string) => ST_VIAGEM.find(x => x.value === s) || ST_VIAGEM[0];

const CATS = [
  { value: 'lugar',       label: 'Lugar',       emoji: '🌍' },
  { value: 'experiencia', label: 'Experiência', emoji: '✨' },
  { value: 'aventura',    label: 'Aventura',    emoji: '🧗' },
  { value: 'gastronomia', label: 'Sabor',       emoji: '🍜' },
] as const;
const catEmoji = (c: string) => CATS.find(x => x.value === c)?.emoji || '🌍';

const ST_BUCKET = [
  { value: 'sonho',      label: 'Sonho',      emoji: '💭' },
  { value: 'planejando', label: 'Planejando', emoji: '📐' },
  { value: 'feito',      label: 'Realizado',  emoji: '✅' },
] as const;

function countdown(ini?: string, fim?: string, status?: string) {
  if (status === 'concluida') return { txt: 'Concluída', cor: '#22c55e' };
  if (!ini) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const di = new Date(ini + 'T12:00:00'); di.setHours(0, 0, 0, 0);
  const df = fim ? new Date(fim + 'T12:00:00') : di; df.setHours(0, 0, 0, 0);
  const dias = Math.round((di.getTime() - hoje.getTime()) / 86400000);
  if (hoje >= di && hoje <= df) return { txt: 'Rolando agora 🌴', cor: '#22c55e' };
  if (dias < 0) return { txt: 'Passou', cor: 'hsl(var(--muted-foreground))' };
  if (dias === 0) return { txt: 'É hoje! 🎉', cor: '#f97316' };
  return { txt: `Faltam ${dias} ${dias === 1 ? 'dia' : 'dias'}`, cor: 'hsl(var(--primary))' };
}

export default function ViagensPage() {
  const { phone } = useAuth();
  const [aba, setAba] = useState<'viagens' | 'bucket'>('viagens');

  const { data: vData, error: vErr, mutate: mV } = useApi(phone ? `viagens:${phone}` : null, () => api.grow.viagens.listar(phone), { shouldRetryOnError: false });
  const { data: bData, error: bErr, mutate: mB } = useApi(phone ? `bucket:${phone}` : null, () => api.grow.bucketList.listar(phone), { shouldRetryOnError: false });
  const viagens: any[] = (vData as any) ?? [];
  const bucket: any[]  = (bData as any) ?? [];
  const erroAtivo = aba === 'viagens' ? vErr : bErr;
  const dataAtiva = aba === 'viagens' ? vData : bData;
  const loading = dataAtiva === undefined && !erroAtivo;

  const [editarV, setEditarV] = useState<any | null>(null);
  const [novoV, setNovoV] = useState(false);
  const [editarB, setEditarB] = useState<any | null>(null);
  const [novoB, setNovoB] = useState(false);

  const salvarV = useCallback(async (form: any, id?: string) => {
    if (id) mV((c: any) => (c || []).map((x: any) => x.id === id ? { ...x, ...form } : x), { revalidate: false });
    else    mV((c: any) => [{ id: `tmp-${Date.now()}`, ...form }, ...(c || [])], { revalidate: false });
    try { if (id) await api.grow.viagens.editar(id, { phone, ...form }); else await api.grow.viagens.criar({ phone, ...form }); } finally { mV(); }
  }, [phone, mV]);
  const removerV = useCallback(async (id: string) => { mV((c: any) => (c || []).filter((x: any) => x.id !== id), { revalidate: false }); try { await api.grow.viagens.deletar(id, phone!); } finally { mV(); } }, [phone, mV]);

  const salvarB = useCallback(async (form: any, id?: string) => {
    if (id) mB((c: any) => (c || []).map((x: any) => x.id === id ? { ...x, ...form } : x), { revalidate: false });
    else    mB((c: any) => [{ id: `tmp-${Date.now()}`, ...form }, ...(c || [])], { revalidate: false });
    try { if (id) await api.grow.bucketList.editar(id, { phone, ...form }); else await api.grow.bucketList.criar({ phone, ...form }); } finally { mB(); }
  }, [phone, mB]);
  const removerB = useCallback(async (id: string) => { mB((c: any) => (c || []).filter((x: any) => x.id !== id), { revalidate: false }); try { await api.grow.bucketList.deletar(id, phone!); } finally { mB(); } }, [phone, mB]);
  const toggleBucket = (b: any) => salvarB({ status: b.status === 'feito' ? 'sonho' : 'feito' }, b.id);

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-6">
      <GrowHero badge="Viagens & Lazer" badgeIcon={Plane} titulo="Viagens & Lazer"
        subtitulo="Planeje as próximas aventuras e guarde os sonhos da sua bucket list.">
        <button onClick={() => (aba === 'viagens' ? setNovoV(true) : setNovoB(true))}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:opacity-90 text-white text-sm font-bold shadow-lg shadow-primary/25 transition-all active:scale-[0.98]">
          <Plus size={16} /> {aba === 'viagens' ? 'Nova viagem' : 'Novo sonho'}
        </button>
      </GrowHero>

      {/* sub-abas */}
      <div className="inline-flex p-1 rounded-2xl bg-muted/50 border border-border/50">
        {(['viagens', 'bucket'] as const).map(a => (
          <button key={a} onClick={() => setAba(a)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${aba === a ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {a === 'viagens' ? '✈️ Viagens' : '🌟 Bucket list'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card rounded-3xl p-12 flex items-center justify-center"><Loader2 size={20} className="animate-spin text-primary" /></div>
      ) : erroAtivo ? (
        <ErroCard onRetry={() => { mV(); mB(); }} />
      ) : aba === 'viagens' ? (
        viagens.length === 0 ? (
          <Vazio emoji="🗺️" titulo="Nenhuma viagem ainda" sub="Planeje a próxima: destino, datas, orçamento e um checklist do que levar." />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {viagens.map((v, i) => {
              const st = stViagem(v.status); const cd = countdown(v.data_inicio, v.data_fim, v.status);
              const chk = Array.isArray(v.checklist) ? v.checklist : [];
              const feitos = chk.filter((c: any) => c.feito).length;
              return (
                <button key={v.id} onClick={() => setEditarV(v)}
                  className="group relative rounded-3xl overflow-hidden text-left ring-1 ring-border/40 bg-card transition-all hover:-translate-y-1 hover:shadow-xl active:scale-[0.99] animate-[slide-up_500ms_ease-out_both]"
                  style={{ animationDelay: `${Math.min(i, 9) * 45}ms` }}>
                  <div className="relative h-28">
                    <Capa url={v.cover_url} emoji={v.emoji || '✈️'} titulo={v.destino} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: st.cor }}>{st.emoji} {st.label}</span>
                    <div className="absolute bottom-2.5 left-3 right-3">
                      <p className="text-white text-lg font-bold leading-tight drop-shadow line-clamp-1">{v.emoji} {v.destino}</p>
                    </div>
                  </div>
                  <div className="p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between text-[13px]">
                      {cd ? <span className="font-bold" style={{ color: cd.cor }}>{cd.txt}</span> : <span className="text-muted-foreground">Sem data</span>}
                      {(v.data_inicio || v.data_fim) && <span className="text-muted-foreground tabular">{fmtDia(v.data_inicio)}{v.data_fim ? ` – ${fmtDia(v.data_fim)}` : ''}</span>}
                    </div>
                    <div className="flex items-center justify-between text-[13px]">
                      {v.orcamento ? <span className="inline-flex items-center gap-1 text-muted-foreground"><Wallet size={13} /> {fmtBRL(Number(v.orcamento))}</span> : <span />}
                      {chk.length > 0 && <span className="inline-flex items-center gap-1 text-muted-foreground tabular"><CheckCircle2 size={13} /> {feitos}/{chk.length}</span>}
                    </div>
                    {chk.length > 0 && <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.round((feitos / chk.length) * 100)}%` }} /></div>}
                  </div>
                </button>
              );
            })}
          </div>
        )
      ) : (
        bucket.length === 0 ? (
          <Vazio emoji="🌟" titulo="Sua bucket list tá vazia" sub="Guarde os sonhos: aquele lugar, aquela experiência, aquela aventura que você quer viver." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {bucket.map((b, i) => {
              const feito = b.status === 'feito';
              return (
                <div key={b.id}
                  className={`group relative overflow-hidden rounded-2xl border p-4 flex items-start gap-3 transition-all animate-[slide-up_500ms_ease-out_both] ${feito ? 'border-emerald-500/40 bg-emerald-500/[0.06]' : 'border-border/40'}`}
                  style={{ animationDelay: `${Math.min(i, 12) * 35}ms`, background: feito ? undefined : 'hsl(var(--bg-card) / 0.5)' }}>
                  <button onClick={() => toggleBucket(b)} aria-label="Marcar realizado"
                    className={`mt-0.5 w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 transition-all active:scale-90 ${feito ? 'bg-emerald-500 text-white' : 'bg-muted/60'}`}>
                    {feito ? '✓' : catEmoji(b.categoria)}
                  </button>
                  <button onClick={() => setEditarB(b)} className="flex-1 min-w-0 text-left">
                    <p className={`text-[15px] font-bold leading-snug ${feito ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{b.titulo}</p>
                    {b.notas && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{b.notas}</p>}
                    <span className="inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{ST_BUCKET.find(s => s.value === b.status)?.emoji} {ST_BUCKET.find(s => s.value === b.status)?.label}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )
      )}

      {(novoV || editarV) && phone && (
        <ViagemModal item={editarV} onClose={() => { setNovoV(false); setEditarV(null); }}
          onSalvar={(f) => { salvarV(f, editarV?.id); setNovoV(false); setEditarV(null); }}
          onRemover={editarV ? () => { removerV(editarV.id); setEditarV(null); } : undefined} />
      )}
      {(novoB || editarB) && phone && (
        <BucketModal item={editarB} onClose={() => { setNovoB(false); setEditarB(null); }}
          onSalvar={(f) => { salvarB(f, editarB?.id); setNovoB(false); setEditarB(null); }}
          onRemover={editarB ? () => { removerB(editarB.id); setEditarB(null); } : undefined} />
      )}
    </div>
  );
}

const EMOJIS_VIAGEM = ['✈️', '🏖️', '🏔️', '🗽', '🏝️', '🎡', '🗼', '🛳️', '🏕️', '🌃', '🚗', '🎢',
  '🧳', '🗺️', '🏨', '🏰', '⛩️', '🕌', '⛪', '🗿', '🌉', '🏙️', '⛱️', '🚢', '⛵', '🎠', '🎪', '🎫', '📸', '🌋', '🏞️', '⛲'];

function ViagemModal({ item, onClose, onSalvar, onRemover }: { item: any | null; onClose: () => void; onSalvar: (f: any) => void; onRemover?: () => void }) {
  const [destino, setDestino] = useState(item?.destino || '');
  const [emoji, setEmoji] = useState(item?.emoji || '✈️');
  const [ini, setIni] = useState(item?.data_inicio || '');
  const [fim, setFim] = useState(item?.data_fim || '');
  const [orc, setOrc] = useState(item?.orcamento?.toString() || '');
  const [status, setStatus] = useState(item?.status || 'planejando');
  const [cover, setCover] = useState(item?.cover_url || '');
  const [notas, setNotas] = useState(item?.notas || '');
  const [chk, setChk] = useState<any[]>(Array.isArray(item?.checklist) ? item.checklist : []);
  const [novoItem, setNovoItem] = useState('');
  const [erro, setErro] = useState('');

  const addItem = () => { const t = novoItem.trim(); if (!t) return; setChk([...chk, { texto: t, feito: false }]); setNovoItem(''); };

  function submit() {
    if (!destino.trim()) { setErro('Pra onde você vai? ✈️'); return; }
    onSalvar({ destino: destino.trim(), emoji, data_inicio: ini || null, data_fim: fim || null, orcamento: orc ? parseFloat(orc) : null, status, cover_url: cover.trim() || null, notas: notas.trim() || null, checklist: chk });
  }

  return (
    <ModalShell titulo={item ? 'Editar viagem' : 'Nova viagem'} onClose={onClose} onSubmit={submit} onDelete={onRemover} erro={erro}>
      <Campo label="Destino">
        <div className="flex gap-2">
          <input value={emoji} onChange={e => setEmoji(e.target.value.slice(0, 2))} className="input w-14 text-center text-xl px-0" />
          <input autoFocus value={destino} onChange={e => setDestino(e.target.value)} placeholder="Ex.: Paris, França" className="input flex-1" maxLength={80} />
        </div>
        <div className="flex flex-wrap gap-1 mt-2">{EMOJIS_VIAGEM.map(e => <button key={e} type="button" onClick={() => setEmoji(e)} className={`w-8 h-8 rounded-lg text-lg transition-all ${emoji === e ? 'bg-primary/15 ring-1 ring-primary' : 'hover:bg-muted'}`}>{e}</button>)}</div>
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo label="Ida"><input type="date" value={ini} onChange={e => setIni(e.target.value)} className="input" /></Campo>
        <Campo label="Volta" hint="opcional"><input type="date" value={fim} onChange={e => setFim(e.target.value)} className="input" /></Campo>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Campo label="Orçamento" hint="opcional"><input value={orc} onChange={e => setOrc(e.target.value.replace(/[^\d.]/g, ''))} placeholder="5000" className="input" inputMode="decimal" /></Campo>
        <Campo label="Capa (URL)" hint="opcional"><input value={cover} onChange={e => setCover(e.target.value)} placeholder="link da foto" className="input" /></Campo>
      </div>

      <Campo label="Status"><Segmented value={status} onChange={setStatus} options={ST_VIAGEM.map(s => ({ value: s.value, label: s.label, emoji: s.emoji }))} /></Campo>

      <Campo label="Checklist" hint="o que não pode esquecer">
        <div className="space-y-1.5">
          {chk.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <button type="button" onClick={() => setChk(chk.map((x, j) => j === i ? { ...x, feito: !x.feito } : x))}
                className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${c.feito ? 'bg-primary border-primary text-white' : 'border-border'}`}>{c.feito && '✓'}</button>
              <span className={`flex-1 text-sm ${c.feito ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{c.texto}</span>
              <button type="button" onClick={() => setChk(chk.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-red-500"><X size={14} /></button>
            </div>
          ))}
          <div className="flex gap-2">
            <input value={novoItem} onChange={e => setNovoItem(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }} placeholder="Adicionar item..." className="input flex-1" />
            <button type="button" onClick={addItem} className="px-3 rounded-xl bg-muted/60 hover:bg-muted text-foreground"><Plus size={16} /></button>
          </div>
        </div>
      </Campo>

      <Campo label="Notas" hint="opcional"><textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} placeholder="Roteiro, ideias, lembretes..." className="input" maxLength={600} /></Campo>
    </ModalShell>
  );
}

function BucketModal({ item, onClose, onSalvar, onRemover }: { item: any | null; onClose: () => void; onSalvar: (f: any) => void; onRemover?: () => void }) {
  const [titulo, setTitulo] = useState(item?.titulo || '');
  const [categoria, setCategoria] = useState(item?.categoria || 'lugar');
  const [status, setStatus] = useState(item?.status || 'sonho');
  const [notas, setNotas] = useState(item?.notas || '');
  const [erro, setErro] = useState('');

  function submit() {
    if (!titulo.trim()) { setErro('Qual é o sonho? 🌟'); return; }
    onSalvar({ titulo: titulo.trim(), categoria, emoji: catEmoji(categoria), status, notas: notas.trim() || null });
  }

  return (
    <ModalShell titulo={item ? 'Editar sonho' : 'Novo sonho'} onClose={onClose} onSubmit={submit} onDelete={onRemover} erro={erro}>
      <Campo label="O que você quer viver?">
        <input autoFocus value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Ver a aurora boreal" className="input" maxLength={120} />
      </Campo>
      <Campo label="Categoria"><Segmented value={categoria} onChange={setCategoria} options={CATS.map(c => ({ value: c.value, label: c.label, emoji: c.emoji }))} /></Campo>
      <Campo label="Status"><Segmented value={status} onChange={setStatus} options={ST_BUCKET.map(s => ({ value: s.value, label: s.label, emoji: s.emoji }))} /></Campo>
      <Campo label="Notas" hint="opcional"><textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} placeholder="Por que isso importa pra você?" className="input" maxLength={400} /></Campo>
    </ModalShell>
  );
}
