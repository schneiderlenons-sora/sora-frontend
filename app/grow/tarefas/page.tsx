'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
  Plus, ListChecks, Loader2, X, Check, Trash2, Sparkles, Tag,
  ChevronRight, AlertCircle, Pencil, FolderPlus,
} from 'lucide-react';
import GrowHero from '@/components/grow/GrowHero';

const BRAND = '#7c3aed';

const PRIORIDADES = [
  { v: 'urgente', l: 'Urgente', cor: '#ef4444', desc: 'Faça agora' },
  { v: 'alta',    l: 'Alta',    cor: '#f97316', desc: 'Hoje' },
  { v: 'media',   l: 'Média',   cor: '#eab308', desc: 'Esta semana' },
  { v: 'baixa',   l: 'Baixa',   cor: '#22c55e', desc: 'Quando der' },
];

const COLUNAS: { v: 'a_fazer' | 'em_progresso' | 'concluida'; l: string; sub: string }[] = [
  { v: 'a_fazer',      l: 'A fazer',      sub: 'Aguardando' },
  { v: 'em_progresso', l: 'Em progresso', sub: 'Trabalhando' },
  { v: 'concluida',    l: 'Concluídas',   sub: 'Feito ✓' },
];

export default function TarefasPage() {
  const { phone } = useAuth();
  const [tarefas, setTarefas]   = useState<any[]>([]);
  const [projetos, setProjetos] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [novaOpen, setNovaOpen] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [novoProjeto, setNovoProjeto] = useState(false);
  const [filtroProjeto, setFiltroProjeto] = useState<string | null>(null);

  const carregar = useCallback(async (silent = false) => {
    if (!phone) return;
    if (!silent) setLoading(true);
    try {
      const [t, p] = await Promise.all([
        api.grow.tarefas.listar(phone),
        api.grow.projetos.listar(phone),
      ]);
      setTarefas(t || []);
      setProjetos(p || []);
    } finally { if (!silent) setLoading(false); }
  }, [phone]);

  useEffect(() => { carregar(); }, [carregar]);

  const tarefasFiltradas = useMemo(() => {
    return filtroProjeto ? tarefas.filter(t => t.projeto_id === filtroProjeto) : tarefas;
  }, [tarefas, filtroProjeto]);

  const porColuna = useMemo(() => {
    const m: any = { a_fazer: [], em_progresso: [], concluida: [] };
    tarefasFiltradas.forEach(t => {
      const col = t.concluida ? 'concluida' : (t.status_kanban || 'a_fazer');
      (m[col] || m.a_fazer).push(t);
    });
    return m;
  }, [tarefasFiltradas]);

  async function moverTarefa(t: any, novaCol: string) {
    setTarefas(prev => prev.map(x => x.id === t.id ? { ...x, status_kanban: novaCol, concluida: novaCol === 'concluida' } : x));
    try {
      await api.grow.tarefas.editar(t.id, { status_kanban: novaCol, concluida: novaCol === 'concluida' });
    } catch (e: any) { alert(e.message); carregar(true); }
  }

  async function deletarTarefa(t: any) {
    if (!phone) return;
    if (!confirm(`Excluir "${t.titulo}"?`)) return;
    // Remove otimisticamente
    setTarefas(prev => prev.filter(x => x.id !== t.id));
    try { await api.grow.tarefas.deletar(t.id, phone); }
    catch (e: any) { alert(e.message); carregar(true); }
  }

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-6">
      <GrowHero
        badge="Tarefas"
        titulo="Tarefas"
        subtitulo="Organize por projeto e prioridade. Mova entre colunas conforme avança."
      >
        <button onClick={() => setNovoProjeto(true)}
                className="btn-ghost px-3 py-2 text-sm gap-2 inline-flex items-center">
          <FolderPlus size={14} /> Novo projeto
        </button>
        <button onClick={() => { setEditando(null); setNovaOpen(true); }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold shadow-lg shadow-violet-600/30">
          <Plus size={16} /> Nova tarefa
        </button>
      </GrowHero>

      {/* Projetos pill bar */}
      {projetos.length > 0 && (
        <div className="flex flex-wrap gap-2 animate-fade-in" style={{ animationDelay: '60ms' }}>
          <button onClick={() => setFiltroProjeto(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              filtroProjeto === null ? 'bg-violet-600 text-white shadow-sm' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}>
            Todos
          </button>
          {projetos.map(p => (
            <button key={p.id} onClick={() => setFiltroProjeto(p.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                filtroProjeto === p.id ? 'text-white shadow-sm' : 'bg-muted/50 hover:bg-muted'
              }`}
              style={filtroProjeto === p.id ? { background: p.cor } : { color: p.cor }}>
              <span>{p.icone}</span> {p.nome}
            </button>
          ))}
        </div>
      )}

      {/* Kanban */}
      {loading ? (
        <div className="card rounded-3xl p-12 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-violet-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in" style={{ animationDelay: '120ms' }}>
          {COLUNAS.map(col => (
            <div key={col.v} className="card rounded-2xl p-4 min-h-[300px]">
              <div className="flex items-center justify-between mb-3 px-1">
                <div>
                  <h3 className="text-sm font-bold text-foreground">{col.l}</h3>
                  <p className="text-[10px] text-muted-foreground">{col.sub}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground tabular">
                  {porColuna[col.v]?.length || 0}
                </span>
              </div>
              <div className="space-y-2">
                {porColuna[col.v]?.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-foreground">Vazio</div>
                ) : porColuna[col.v].map((t: any) => {
                  const pri = PRIORIDADES.find(p => p.v === t.prioridade);
                  return (
                    <div
                      key={t.id}
                      className="group bg-card border border-border/60 rounded-xl p-3 hover:border-violet-300 dark:hover:border-violet-800 transition-all cursor-pointer"
                      onClick={() => { setEditando(t); setNovaOpen(true); }}
                    >
                      <div className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: pri?.cor || '#eab308' }} />
                        <p className={`text-sm font-medium flex-1 ${t.concluida ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {t.titulo}
                        </p>
                        <button
                          onClick={(e) => { e.stopPropagation(); deletarTarefa(t); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40"
                        >
                          <Trash2 size={11} className="text-red-500" />
                        </button>
                      </div>
                      {(t.projetos || t.tags?.length) && (
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap pl-3.5">
                          {t.projetos && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                  style={{ background: `${t.projetos.cor}22`, color: t.projetos.cor }}>
                              {t.projetos.icone} {t.projetos.nome}
                            </span>
                          )}
                          {t.tags?.map((tag: string, i: number) => (
                            <span key={i} className="text-[9px] text-muted-foreground inline-flex items-center gap-0.5">
                              <Tag size={8} /> {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-1 mt-2 pl-3.5">
                        {COLUNAS.filter(c => c.v !== col.v).map(c => (
                          <button
                            key={c.v}
                            onClick={(e) => { e.stopPropagation(); moverTarefa(t, c.v); }}
                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-muted/40 hover:bg-violet-100 dark:hover:bg-violet-950/40 text-muted-foreground hover:text-violet-700 dark:hover:text-violet-300 transition-colors inline-flex items-center gap-0.5"
                          >
                            <ChevronRight size={8} /> {c.l}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {novaOpen && phone && (
        <ModalTarefa
          phone={phone}
          tarefa={editando}
          projetos={projetos}
          onClose={() => { setNovaOpen(false); setEditando(null); }}
          onSuccess={() => { carregar(true); setNovaOpen(false); setEditando(null); }}
        />
      )}

      {novoProjeto && phone && (
        <ModalProjeto
          phone={phone}
          onClose={() => setNovoProjeto(false)}
          onSuccess={() => { carregar(true); setNovoProjeto(false); }}
        />
      )}
    </div>
  );
}

function ModalTarefa({ phone, tarefa, projetos, onClose, onSuccess }: any) {
  const ed = !!tarefa;
  const [titulo, setTitulo] = useState(tarefa?.titulo || '');
  const [descricao, setDescricao] = useState(tarefa?.descricao || '');
  const [prioridade, setPrioridade] = useState(tarefa?.prioridade || 'media');
  const [projetoId, setProjetoId] = useState(tarefa?.projeto_id || '');
  const [tagsStr, setTagsStr] = useState((tarefa?.tags || []).join(', '));
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar() {
    setErro('');
    if (!titulo.trim()) { setErro('Título obrigatório.'); return; }
    setLoading(true);
    const tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
    try {
      if (ed) await api.grow.tarefas.editar(tarefa.id, { titulo: titulo.trim(), descricao, prioridade, projeto_id: projetoId || null, tags });
      else    await api.grow.tarefas.criar({ phone, titulo: titulo.trim(), descricao, prioridade, projeto_id: projetoId || null, tags });
      onSuccess();
    } catch (e: any) { setErro(e.message); } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden border border-border animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground">{ed ? 'Editar tarefa' : 'Nova tarefa'}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Título</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="O que precisa fazer?" className="input" autoFocus />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Descrição</label>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2} placeholder="Detalhes..." className="input" />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Prioridade</label>
            <div className="grid grid-cols-4 gap-1.5">
              {PRIORIDADES.map(p => (
                <button key={p.v} type="button" onClick={() => setPrioridade(p.v)}
                  className={`p-2.5 rounded-xl border transition-all ${prioridade === p.v ? 'ring-1' : 'border-border bg-muted/20 hover:border-violet-300'}`}
                  style={prioridade === p.v ? { borderColor: p.cor, background: `${p.cor}15`, ['--tw-ring-color' as any]: p.cor } : {}}>
                  <span className="w-2 h-2 rounded-full inline-block mx-auto mb-1" style={{ background: p.cor }} />
                  <p className="text-[10px] font-bold text-foreground">{p.l}</p>
                </button>
              ))}
            </div>
          </div>
          {projetos.length > 0 && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Projeto</label>
              <select value={projetoId} onChange={e => setProjetoId(e.target.value)} className="input">
                <option value="">— Sem projeto —</option>
                {projetos.map((p: any) => <option key={p.id} value={p.id}>{p.icone} {p.nome}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Tags <span className="text-muted-foreground/60 normal-case font-normal">(separe por vírgula)</span></label>
            <input value={tagsStr} onChange={e => setTagsStr(e.target.value)} placeholder="trabalho, urgente, pessoal" className="input" />
          </div>
          {erro && <div className="rounded-xl p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-start gap-2">
            <AlertCircle size={14} className="text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-700 dark:text-red-400">{erro}</p>
          </div>}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
          <button onClick={salvar} disabled={loading || !titulo.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {ed ? 'Salvar' : 'Criar tarefa'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalProjeto({ phone, onClose, onSuccess }: any) {
  const [nome, setNome] = useState('');
  const [icone, setIcone] = useState('📋');
  const [cor, setCor] = useState(BRAND);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const ICONES_PROJ = ['📋','💼','🏠','🎓','💪','✈️','🎨','🔬','💻','📚','🎮','🛒'];
  const CORES_PROJ = ['#7c3aed','#ec4899','#f59e0b','#10b981','#06b6d4','#3b82f6','#ef4444','#84cc16'];

  async function salvar() {
    setErro('');
    if (!nome.trim()) { setErro('Nome obrigatório.'); return; }
    setLoading(true);
    try { await api.grow.projetos.criar({ phone, nome: nome.trim(), icone, cor }); onSuccess(); }
    catch (e: any) { setErro(e.message); } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm bg-card rounded-3xl shadow-2xl overflow-hidden border border-border animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground">Novo projeto</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do projeto" className="input" autoFocus />
          <div className="grid grid-cols-6 gap-2">
            {ICONES_PROJ.map(i => (
              <button key={i} onClick={() => setIcone(i)} className={`w-10 h-10 rounded-xl text-xl transition-all ${icone === i ? 'ring-2 ring-violet-500 scale-110 bg-violet-100 dark:bg-violet-950/40' : 'bg-muted/40 hover:bg-muted'}`}>{i}</button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {CORES_PROJ.map(c => (
              <button key={c} onClick={() => setCor(c)}
                className={`w-9 h-9 rounded-xl transition-all ${cor === c ? 'scale-110 ring-2 ring-offset-2 ring-offset-card' : ''}`}
                style={{ background: c, ['--tw-ring-color' as any]: c }} />
            ))}
          </div>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
          <button onClick={salvar} disabled={loading || !nome.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Criar
          </button>
        </div>
      </div>
    </div>
  );
}
