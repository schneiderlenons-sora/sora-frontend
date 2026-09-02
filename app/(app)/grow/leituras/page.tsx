'use client';
import SectionSkeleton from '@/components/ui/SectionSkeleton';

import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { BookOpen, Plus, Star, BookMarked, CheckCircle2, Trophy } from 'lucide-react';
import GrowHero from '@/components/grow/GrowHero';
import { Capa, StatBox, Filtros, Segmented, NotaInput, NotaBadge, Campo, ModalShell, Vazio, ErroCard, favRing, FavBadge, ordenarPorNota } from '@/components/grow/colecao';

const STATUS = [
  { value: 'quero',     label: 'Quero ler', emoji: '🔖' },
  { value: 'lendo',     label: 'Lendo',     emoji: '📖' },
  { value: 'lido',      label: 'Lido',      emoji: '✅' },
  { value: 'abandonei', label: 'Larguei',   emoji: '🚪' },
] as const;
const labelStatus = (s: string) => STATUS.find(x => x.value === s)?.label || s;
const pct = (a?: number, t?: number) => (t && t > 0 ? Math.min(100, Math.round(((a || 0) / t) * 100)) : 0);

export default function LeiturasPage() {
  const { phone } = useAuth();
  const { data, error, mutate } = useApi(phone ? `leituras:${phone}` : null, () => api.grow.leituras.listar(phone), { shouldRetryOnError: false });
  const itens: any[] = (data as any) ?? [];
  const loading = data === undefined && !error;

  const [fStatus, setFStatus] = useState<string>('todos');
  const [editar, setEditar]   = useState<any | null>(null);
  const [novo, setNovo]       = useState(false);

  const stats = useMemo(() => {
    const lidos = itens.filter(i => i.status === 'lido').length;
    const lendo = itens.filter(i => i.status === 'lendo').length;
    const avaliados = itens.filter(i => i.nota != null);
    const media = avaliados.length ? avaliados.reduce((s, i) => s + Number(i.nota), 0) / avaliados.length : null;
    return { total: itens.length, lidos, lendo, media };
  }, [itens]);

  const filtrados = useMemo(() => ordenarPorNota(itens.filter(i => fStatus === 'todos' || i.status === fStatus)), [itens, fStatus]);

  const salvar = useCallback(async (form: any, id?: string) => {
    if (id) mutate((cur: any) => (cur || []).map((x: any) => x.id === id ? { ...x, ...form } : x), { revalidate: false });
    else    mutate((cur: any) => [{ id: `tmp-${Date.now()}`, ...form }, ...(cur || [])], { revalidate: false });
    try {
      if (id) await api.grow.leituras.editar(id, { phone, ...form });
      else    await api.grow.leituras.criar({ phone, ...form });
    } finally { mutate(); }
  }, [phone, mutate]);

  const remover = useCallback(async (id: string) => {
    mutate((cur: any) => (cur || []).filter((x: any) => x.id !== id), { revalidate: false });
    try { await api.grow.leituras.deletar(id, phone!); } finally { mutate(); }
  }, [phone, mutate]);

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-6">
      <GrowHero badge="Leituras" badgeIcon={BookOpen} titulo="Leituras"
        subtitulo="Sua estante de livros — na fila, lendo agora, lidos e desejos.">
        <button onClick={() => setNovo(true)}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:opacity-90 text-white text-sm font-bold shadow-lg shadow-primary/25 transition-all active:scale-[0.98]">
          <Plus size={16} /> Adicionar livro
        </button>
      </GrowHero>

      {loading ? (
        <SectionSkeleton />
      ) : error ? (
        <ErroCard onRetry={() => mutate()} />
      ) : itens.length === 0 ? (
        <Vazio emoji="📚" titulo="Sua estante tá vazia" sub="Adicione o primeiro livro — pode ser um que você quer ler, tá lendo ou já leu." />
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2.5 sm:gap-4 animate-fade-in">
            <StatBox icon={BookOpen} label="Total" value={String(stats.total)} cor="hsl(var(--primary))" />
            <StatBox icon={CheckCircle2} label="Lidos" value={String(stats.lidos)} cor="#22c55e" />
            <StatBox icon={BookMarked} label="Lendo" value={String(stats.lendo)} cor="#f59e0b" />
            <StatBox icon={Trophy} label="Nota média" value={stats.media != null ? stats.media.toFixed(1) : '—'} cor="#ec4899" />
          </div>

          <div className="animate-fade-in" style={{ animationDelay: '60ms' }}>
            <Filtros value={fStatus} onChange={setFStatus}
              options={[{ value: 'todos', label: 'Todos' }, ...STATUS.map(s => ({ value: s.value, label: s.label }))]} />
          </div>

          {filtrados.length === 0 ? (
            <Vazio emoji="🔍" titulo="Nada com esse filtro" sub="Tenta outro status." />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {filtrados.map((b, i) => {
                const p = pct(b.pagina_atual, b.total_paginas);
                return (
                  <button key={b.id} onClick={() => setEditar(b)}
                    className={`group relative rounded-2xl overflow-hidden text-left aspect-[2/3] bg-muted/40 ${favRing(b.favorito)} transition-all hover:-translate-y-1 hover:shadow-xl active:scale-[0.98] animate-[slide-up_500ms_ease-out_both]`}
                    style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
                    <Capa url={b.cover_url} emoji="📖" titulo={b.titulo} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                    {b.favorito && <FavBadge />}
                    {b.nota != null && <span className="absolute top-2 right-2"><NotaBadge nota={b.nota} /></span>}
                    <div className="absolute inset-x-0 bottom-0 p-2.5">
                      <p className="text-white text-[13px] font-bold leading-tight line-clamp-2 drop-shadow">{b.titulo}</p>
                      {b.autor && <p className="text-white/70 text-[11px] line-clamp-1 mt-0.5">{b.autor}</p>}
                      {b.status === 'lendo' && b.total_paginas ? (
                        <div className="mt-1.5">
                          <div className="h-1 rounded-full bg-white/25 overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${p}%` }} /></div>
                          <p className="text-white/60 text-[9px] font-semibold mt-0.5 tabular">{p}%</p>
                        </div>
                      ) : (
                        <p className="text-white/70 text-[10px] font-semibold uppercase tracking-wide mt-0.5">{labelStatus(b.status)}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {(novo || editar) && phone && (
        <LivroModal item={editar} onClose={() => { setNovo(false); setEditar(null); }}
          onSalvar={(f) => { salvar(f, editar?.id); setNovo(false); setEditar(null); }}
          onRemover={editar ? () => { remover(editar.id); setEditar(null); } : undefined} />
      )}
    </div>
  );
}

function LivroModal({ item, onClose, onSalvar, onRemover }:
  { item: any | null; onClose: () => void; onSalvar: (f: any) => void; onRemover?: () => void }) {
  const [titulo, setTitulo] = useState(item?.titulo || '');
  const [autor, setAutor]   = useState(item?.autor || '');
  const [status, setStatus] = useState(item?.status || 'quero');
  const [nota, setNota]     = useState<number | null>(item?.nota ?? null);
  const [cover, setCover]   = useState(item?.cover_url || '');
  const [total, setTotal]   = useState(item?.total_paginas?.toString() || '');
  const [atual, setAtual]   = useState(item?.pagina_atual?.toString() || '');
  const [genero, setGenero] = useState(item?.genero || '');
  const [coment, setComent] = useState(item?.comentario || '');
  const [fav, setFav]       = useState(!!item?.favorito);
  const [erro, setErro]     = useState('');

  function submit() {
    if (!titulo.trim()) { setErro('Dá um título 🙂'); return; }
    onSalvar({
      titulo: titulo.trim(), autor: autor.trim() || null, status, nota, favorito: fav,
      cover_url: cover.trim() || null, genero: genero.trim() || null,
      total_paginas: total ? parseInt(total) : null, pagina_atual: atual ? parseInt(atual) : 0,
      comentario: coment.trim() || null,
    });
  }

  return (
    <ModalShell titulo={item ? 'Editar livro' : 'Adicionar livro'} onClose={onClose} onSubmit={submit} onDelete={onRemover} erro={erro}>
      <div className="flex gap-4">
        <div className="w-24 flex-shrink-0 aspect-[2/3] rounded-xl overflow-hidden ring-1 ring-border/50">
          <Capa url={cover} emoji="📖" titulo={titulo || 'capa'} />
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <Campo label="Título"><input autoFocus value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: O Hobbit" className="input" maxLength={140} /></Campo>
          <Campo label="Autor" hint="opcional"><input value={autor} onChange={e => setAutor(e.target.value)} placeholder="J.R.R. Tolkien" className="input" /></Campo>
        </div>
      </div>

      <Campo label="Capa (URL)" hint="opcional">
        <input value={cover} onChange={e => setCover(e.target.value)} placeholder="cole o link de uma imagem" className="input" />
      </Campo>

      <Campo label="Status">
        <Segmented value={status} onChange={setStatus} options={STATUS.map(s => ({ value: s.value, label: s.label }))} />
      </Campo>

      {status === 'lendo' && (
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Página atual"><input value={atual} onChange={e => setAtual(e.target.value.replace(/\D/g, ''))} placeholder="120" className="input" inputMode="numeric" /></Campo>
          <Campo label="Total de páginas"><input value={total} onChange={e => setTotal(e.target.value.replace(/\D/g, ''))} placeholder="310" className="input" inputMode="numeric" /></Campo>
        </div>
      )}

      <NotaInput value={nota} onChange={setNota} />

      <Campo label="Gênero" hint="opcional"><input value={genero} onChange={e => setGenero(e.target.value)} placeholder="Fantasia" className="input" /></Campo>
      <Campo label="Comentário" hint="opcional"><textarea value={coment} onChange={e => setComent(e.target.value)} rows={2} placeholder="O que achou?" className="input" maxLength={500} /></Campo>

      <button type="button" onClick={() => setFav(v => !v)}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all border ${fav ? 'bg-yellow-400/15 border-yellow-400/50 text-yellow-600 dark:text-yellow-300' : 'bg-muted/30 border-border/60 text-muted-foreground'}`}>
        <Star size={15} className={fav ? 'fill-current' : ''} /> {fav ? 'Favorito' : 'Marcar favorito'}
      </button>
    </ModalShell>
  );
}
