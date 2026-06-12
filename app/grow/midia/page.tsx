'use client';

import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { Clapperboard, Plus, Loader2, Star, Film, Eye, Trophy } from 'lucide-react';
import GrowHero from '@/components/grow/GrowHero';
import { Capa, StatBox, Filtros, Segmented, NotaInput, NotaBadge, Campo, ModalShell, Vazio, ErroCard, favRing, FavBadge, ordenarPorNota } from '@/components/grow/colecao';

const TIPOS = [
  { value: 'filme',   label: 'Filme',   emoji: '🎬' },
  { value: 'serie',   label: 'Série',   emoji: '📺' },
  { value: 'desenho', label: 'Desenho', emoji: '🧸' },
  { value: 'anime',   label: 'Anime',   emoji: '🍥' },
  { value: 'doc',     label: 'Doc',     emoji: '🎥' },
] as const;
const STATUS = [
  { value: 'quero',      label: 'Quero ver',  emoji: '🔖' },
  { value: 'assistindo', label: 'Assistindo', emoji: '▶️' },
  { value: 'visto',      label: 'Visto',      emoji: '✅' },
  { value: 'abandonei',  label: 'Larguei',    emoji: '🚪' },
] as const;
const emojiTipo = (t: string) => TIPOS.find(x => x.value === t)?.emoji || '🎬';
const labelStatus = (s: string) => STATUS.find(x => x.value === s)?.label || s;

export default function MidiaPage() {
  const { phone } = useAuth();
  const { data, error, mutate } = useApi(phone ? `midia:${phone}` : null, () => api.grow.midia.listar(phone), { shouldRetryOnError: false });
  const itens: any[] = (data as any) ?? [];
  const loading = data === undefined && !error;

  const [fTipo, setFTipo]     = useState<string>('todos');
  const [fStatus, setFStatus] = useState<string>('todos');
  const [editar, setEditar]   = useState<any | null>(null);
  const [novo, setNovo]       = useState(false);

  const stats = useMemo(() => {
    const vistos = itens.filter(i => i.status === 'visto').length;
    const avaliados = itens.filter(i => i.nota != null);
    const media = avaliados.length ? (avaliados.reduce((s, i) => s + Number(i.nota), 0) / avaliados.length) : null;
    const favs = itens.filter(i => i.favorito).length;
    return { total: itens.length, vistos, media, favs };
  }, [itens]);

  const filtrados = useMemo(() => ordenarPorNota(itens.filter(i =>
    (fTipo === 'todos' || i.tipo === fTipo) && (fStatus === 'todos' || i.status === fStatus)
  )), [itens, fTipo, fStatus]);

  const salvar = useCallback(async (form: any, id?: string) => {
    if (id) mutate((cur: any) => (cur || []).map((x: any) => x.id === id ? { ...x, ...form } : x), { revalidate: false });
    else    mutate((cur: any) => [{ id: `tmp-${Date.now()}`, ...form }, ...(cur || [])], { revalidate: false });
    try {
      if (id) await api.grow.midia.editar(id, { phone, ...form });
      else    await api.grow.midia.criar({ phone, ...form });
    } finally { mutate(); }
  }, [phone, mutate]);

  const remover = useCallback(async (id: string) => {
    mutate((cur: any) => (cur || []).filter((x: any) => x.id !== id), { revalidate: false });
    try { await api.grow.midia.deletar(id, phone!); } finally { mutate(); }
  }, [phone, mutate]);

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-6">
      <GrowHero badge="Cinema" badgeIcon={Clapperboard} titulo="Filmes & Séries"
        subtitulo="Sua estante de filmes, séries, desenhos e animes — com nota e capa.">
        <button onClick={() => setNovo(true)}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:opacity-90 text-white text-sm font-bold shadow-lg shadow-primary/25 transition-all active:scale-[0.98]">
          <Plus size={16} /> Adicionar
        </button>
      </GrowHero>

      {loading ? (
        <div className="card rounded-3xl p-12 flex items-center justify-center"><Loader2 size={20} className="animate-spin text-primary" /></div>
      ) : error ? (
        <ErroCard onRetry={() => mutate()} />
      ) : itens.length === 0 ? (
        <Vazio emoji="🍿" titulo="Sua estante tá vazia" sub="Adicione o primeiro filme ou série, dê sua nota e monte sua coleção." />
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2.5 sm:gap-4 animate-fade-in">
            <StatBox icon={Film} label="Total" value={String(stats.total)} cor="hsl(var(--primary))" />
            <StatBox icon={Eye} label="Vistos" value={String(stats.vistos)} cor="#22c55e" />
            <StatBox icon={Trophy} label="Nota média" value={stats.media != null ? stats.media.toFixed(1) : '—'} cor="#f59e0b" />
            <StatBox icon={Star} label="Favoritos" value={String(stats.favs)} cor="#ec4899" />
          </div>

          <div className="space-y-2 animate-fade-in" style={{ animationDelay: '60ms' }}>
            <Filtros value={fTipo} onChange={setFTipo}
              options={[{ value: 'todos', label: 'Todos' }, ...TIPOS.map(t => ({ value: t.value, label: t.label }))]} />
            <Filtros value={fStatus} onChange={setFStatus}
              options={[{ value: 'todos', label: 'Tudo' }, ...STATUS.map(s => ({ value: s.value, label: s.label }))]} />
          </div>

          {filtrados.length === 0 ? (
            <Vazio emoji="🔍" titulo="Nada com esse filtro" sub="Tenta outro tipo ou status." />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {filtrados.map((m, i) => (
                <button key={m.id} onClick={() => setEditar(m)}
                  className={`group relative rounded-2xl overflow-hidden text-left aspect-[2/3] bg-muted/40 ${favRing(m.favorito)} transition-all hover:-translate-y-1 hover:shadow-xl active:scale-[0.98] animate-[slide-up_500ms_ease-out_both]`}
                  style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
                  <Capa url={m.cover_url} emoji={emojiTipo(m.tipo)} titulo={m.titulo} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                  {m.favorito && <FavBadge />}
                  {m.nota != null && <span className="absolute top-2 right-2"><NotaBadge nota={m.nota} /></span>}
                  <div className="absolute inset-x-0 bottom-0 p-2.5">
                    <p className="text-white text-[13px] font-bold leading-tight line-clamp-2 drop-shadow">{m.titulo}</p>
                    <p className="text-white/70 text-[10px] font-semibold uppercase tracking-wide mt-0.5">{emojiTipo(m.tipo)} {labelStatus(m.status)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {(novo || editar) && phone && (
        <MidiaModal item={editar} onClose={() => { setNovo(false); setEditar(null); }}
          onSalvar={(f) => { salvar(f, editar?.id); setNovo(false); setEditar(null); }}
          onRemover={editar ? () => { remover(editar.id); setEditar(null); } : undefined} />
      )}
    </div>
  );
}

function MidiaModal({ item, onClose, onSalvar, onRemover }:
  { item: any | null; onClose: () => void; onSalvar: (f: any) => void; onRemover?: () => void }) {
  const [titulo, setTitulo]   = useState(item?.titulo || '');
  const [tipo, setTipo]       = useState(item?.tipo || 'filme');
  const [status, setStatus]   = useState(item?.status || 'quero');
  const [nota, setNota]       = useState<number | null>(item?.nota ?? null);
  const [cover, setCover]     = useState(item?.cover_url || '');
  const [genero, setGenero]   = useState(item?.genero || '');
  const [ano, setAno]         = useState(item?.ano?.toString() || '');
  const [coment, setComent]   = useState(item?.comentario || '');
  const [fav, setFav]         = useState(!!item?.favorito);
  const [erro, setErro]       = useState('');

  function submit() {
    if (!titulo.trim()) { setErro('Dá um título 🙂'); return; }
    onSalvar({
      titulo: titulo.trim(), tipo, status, nota, favorito: fav,
      cover_url: cover.trim() || null, genero: genero.trim() || null,
      ano: ano ? parseInt(ano) : null, comentario: coment.trim() || null,
    });
  }

  return (
    <ModalShell titulo={item ? 'Editar' : 'Adicionar à estante'} onClose={onClose} onSubmit={submit} onDelete={onRemover} erro={erro}>
      <div className="flex gap-4">
        <div className="w-24 flex-shrink-0 aspect-[2/3] rounded-xl overflow-hidden ring-1 ring-border/50">
          <Capa url={cover} emoji={emojiTipo(tipo)} titulo={titulo || 'capa'} />
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <Campo label="Título">
            <input autoFocus value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Interestelar" className="input" maxLength={120} />
          </Campo>
          <Campo label="Capa (URL)" hint="opcional">
            <input value={cover} onChange={e => setCover(e.target.value)} placeholder="cole o link de uma imagem" className="input" />
          </Campo>
        </div>
      </div>

      <Campo label="Tipo">
        <Segmented value={tipo} onChange={setTipo} options={TIPOS.map(t => ({ value: t.value, label: t.label, emoji: t.emoji }))} />
      </Campo>
      <Campo label="Status">
        <Segmented value={status} onChange={setStatus} options={STATUS.map(s => ({ value: s.value, label: s.label }))} />
      </Campo>

      <NotaInput value={nota} onChange={setNota} />

      <div className="grid grid-cols-2 gap-3">
        <Campo label="Gênero" hint="opcional"><input value={genero} onChange={e => setGenero(e.target.value)} placeholder="Ficção" className="input" /></Campo>
        <Campo label="Ano" hint="opcional"><input value={ano} onChange={e => setAno(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="2014" className="input" inputMode="numeric" /></Campo>
      </div>

      <Campo label="Comentário" hint="opcional">
        <textarea value={coment} onChange={e => setComent(e.target.value)} rows={2} placeholder="O que achou?" className="input" maxLength={500} />
      </Campo>

      <button type="button" onClick={() => setFav(v => !v)}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all border ${fav ? 'bg-yellow-400/15 border-yellow-400/50 text-yellow-600 dark:text-yellow-300' : 'bg-muted/30 border-border/60 text-muted-foreground'}`}>
        <Star size={15} className={fav ? 'fill-current' : ''} /> {fav ? 'Favorito' : 'Marcar favorito'}
      </button>
    </ModalShell>
  );
}
