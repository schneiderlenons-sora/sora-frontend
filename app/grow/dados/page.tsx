'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import GrowHero from '@/components/grow/GrowHero';
import {
  Lock, ShieldCheck, ShieldOff, Loader2, Plus, ChevronLeft, ChevronRight, X,
  Pencil, Trash2, Copy, Check, Eye, EyeOff, KeyRound, FileText, Paperclip, Download,
} from 'lucide-react';

const BRAND = 'hsl(var(--primary))';
const PALETA = ['#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#64748b'];
const ICONES_QUADRO = ['📁', '🗂️', '🔐', '🏦', '🪪', '📄', '🏥', '🚗', '🎓', '🏠', '💼', '⭐'];
const TIPOS = [
  { v: 'campo',   l: 'Campo',   icon: FileText,  desc: 'Rótulo + valor curto' },
  { v: 'nota',    l: 'Nota',    icon: FileText,  desc: 'Texto longo' },
  { v: 'senha',   l: 'Senha',   icon: KeyRound,  desc: 'Valor oculto' },
  { v: 'arquivo', l: 'Arquivo', icon: Paperclip, desc: 'PDF, doc, imagem' },
];

export default function DadosPessoaisPage() {
  const { phone } = useAuth();
  const [unlocked, setUnlocked] = useState(false);
  const [pinStatus, setPinStatus] = useState<{ definido: boolean; travadoAte: string | null } | null>(null);

  useEffect(() => {
    if (!phone) return;
    try { if (sessionStorage.getItem(`dados-unlocked-${phone}`) === '1') setUnlocked(true); } catch {}
    api.dados.pin.status(phone).then(setPinStatus).catch(() => setPinStatus({ definido: false, travadoAte: null }));
  }, [phone]);

  const desbloquear = useCallback(() => {
    try { sessionStorage.setItem(`dados-unlocked-${phone}`, '1'); } catch {}
    setUnlocked(true);
  }, [phone]);

  if (!phone || pinStatus === null) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 size={24} className="animate-spin text-primary" /></div>;
  }

  // Tem PIN e ainda não desbloqueou → tela de PIN
  if (pinStatus.definido && !unlocked) {
    return <PinGate phone={phone} travadoAte={pinStatus.travadoAte} onUnlock={desbloquear} />;
  }

  return <Vault phone={phone} temPin={pinStatus.definido} onPinChange={(d) => setPinStatus(s => ({ ...(s||{travadoAte:null}), definido: d }))} />;
}

// ════════════════ TELA DE PIN (desbloqueio) ════════════════
function PinGate({ phone, travadoAte, onUnlock }: { phone: string; travadoAte: string | null; onUnlock: () => void }) {
  const { user } = useAuth();
  const [pin, setPin] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [travaAte, setTravaAte] = useState<string | null>(travadoAte);
  const [forgot, setForgot] = useState(false);

  const travado = travaAte && new Date(travaAte) > new Date();

  const tentar = useCallback(async (codigo: string) => {
    setCarregando(true); setErro('');
    try {
      const r = await api.dados.pin.verificar({ phone, pin: codigo });
      if (r.ok) { onUnlock(); return; }
      setPin('');
      if (r.travadoAte) { setTravaAte(r.travadoAte); setErro('Muitas tentativas. Tente mais tarde.'); }
      else setErro(`PIN incorreto.${r.restantes != null ? ` ${r.restantes} tentativa(s) restante(s).` : ''}`);
    } catch (e: any) {
      setPin('');
      if (e?.status === 429 || /muita/i.test(e?.message || '')) setErro('Bloqueado. Tente mais tarde.');
      else setErro('PIN incorreto.');
    } finally { setCarregando(false); }
  }, [phone, onUnlock]);

  // dispara automaticamente ao completar 4 dígitos
  useEffect(() => { if (pin.length === 4 && !carregando && !travado) tentar(pin); }, [pin, carregando, travado, tentar]);

  if (forgot) return <EsqueciPin phone={phone} email={user?.email || ''} onPronto={onUnlock} onVoltar={() => setForgot(false)} />;

  return (
    <div className="max-w-sm mx-auto pt-16 pb-20 px-2 text-center animate-[slide-up_400ms_ease-out_both]">
      <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-5" style={{ background: 'color-mix(in srgb, hsl(var(--primary)) 14%, transparent)' }}>
        <Lock size={28} style={{ color: BRAND }} />
      </div>
      <h1 className="text-2xl font-bold text-foreground">Dados Pessoais</h1>
      <p className="text-sm text-muted-foreground mt-2 mb-7">Digite seu PIN de 4 dígitos pra acessar.</p>

      <PinDots valor={pin} />

      {erro && <p className="text-sm text-red-500 mt-4">{erro}</p>}
      {travado && <p className="text-sm text-amber-500 mt-2">🔒 Tente novamente mais tarde.</p>}

      <Teclado disabled={carregando || !!travado} onDigito={(d) => setPin(p => (p + d).slice(0, 4))} onApagar={() => setPin(p => p.slice(0, -1))} />

      <button onClick={() => setForgot(true)} className="mt-7 text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
        Esqueci meu PIN
      </button>
    </div>
  );
}

function PinDots({ valor }: { valor: string }) {
  return (
    <div className="flex items-center justify-center gap-3.5">
      {[0, 1, 2, 3].map(i => (
        <span key={i} className="w-3.5 h-3.5 rounded-full transition-all duration-150"
          style={{ background: i < valor.length ? BRAND : 'hsl(var(--foreground) / 0.15)', transform: i < valor.length ? 'scale(1.1)' : 'scale(1)' }} />
      ))}
    </div>
  );
}

function Teclado({ onDigito, onApagar, disabled }: { onDigito: (d: string) => void; onApagar: () => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto mt-8">
      {['1','2','3','4','5','6','7','8','9'].map(n => (
        <button key={n} disabled={disabled} onClick={() => onDigito(n)}
          className="h-16 rounded-2xl text-2xl font-semibold text-foreground bg-foreground/[0.04] border border-border/40 hover:bg-foreground/[0.08] active:scale-95 transition-all disabled:opacity-40"
          style={{ minHeight: 56 }}>
          {n}
        </button>
      ))}
      <span />
      <button disabled={disabled} onClick={() => onDigito('0')}
        className="h-16 rounded-2xl text-2xl font-semibold text-foreground bg-foreground/[0.04] border border-border/40 hover:bg-foreground/[0.08] active:scale-95 transition-all disabled:opacity-40" style={{ minHeight: 56 }}>0</button>
      <button disabled={disabled} onClick={onApagar} aria-label="Apagar"
        className="h-16 rounded-2xl flex items-center justify-center text-foreground/70 hover:bg-foreground/[0.06] active:scale-95 transition-all" style={{ minHeight: 56 }}>
        <ChevronLeft size={22} />
      </button>
    </div>
  );
}

// ════════════════ ESQUECI O PIN (confirma senha da conta) ════════════════
function EsqueciPin({ phone, email, onPronto, onVoltar }: { phone: string; email: string; onPronto: () => void; onVoltar: () => void }) {
  const [etapa, setEtapa] = useState<'senha' | 'novo'>('senha');
  const [senha, setSenha] = useState('');
  const [pinNovo, setPinNovo] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const confirmarSenha = async () => {
    setCarregando(true); setErro('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) { setErro('Senha da conta incorreta.'); return; }
      setEtapa('novo');
    } catch { setErro('Não consegui validar. Tente de novo.'); }
    finally { setCarregando(false); }
  };

  const salvarNovo = async () => {
    if (!/^\d{4}$/.test(pinNovo)) { setErro('O PIN deve ter 4 dígitos.'); return; }
    setCarregando(true); setErro('');
    try { await api.dados.pin.resetar({ phone, pinNovo }); onPronto(); }
    catch { setErro('Não consegui salvar o novo PIN.'); }
    finally { setCarregando(false); }
  };

  return (
    <div className="max-w-sm mx-auto pt-16 pb-20 px-4 animate-[slide-up_400ms_ease-out_both]">
      <button onClick={onVoltar} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"><ChevronLeft size={16} /> Voltar</button>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'color-mix(in srgb, hsl(var(--primary)) 14%, transparent)' }}>
        <KeyRound size={24} style={{ color: BRAND }} />
      </div>
      <h1 className="text-xl font-bold text-foreground mb-1">Redefinir PIN</h1>
      {etapa === 'senha' ? (
        <>
          <p className="text-sm text-muted-foreground mb-5">Confirme a <strong>senha da sua conta</strong> pra criar um novo PIN.</p>
          <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Senha da conta" autoComplete="current-password"
            className="w-full rounded-xl border border-border/60 bg-background px-4 py-3 text-foreground outline-none focus:border-primary" />
          {erro && <p className="text-sm text-red-500 mt-2">{erro}</p>}
          <button onClick={confirmarSenha} disabled={carregando || !senha} className="mt-4 w-full rounded-xl bg-primary text-white font-bold py-3 disabled:opacity-50 inline-flex items-center justify-center gap-2">
            {carregando ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar senha'}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-5">Senha confirmada ✓ Agora escolha um <strong>novo PIN de 4 dígitos</strong>.</p>
          <input inputMode="numeric" value={pinNovo} onChange={e => setPinNovo(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="• • • •"
            className="w-full rounded-xl border border-border/60 bg-background px-4 py-3 text-center text-2xl tracking-[0.5em] text-foreground outline-none focus:border-primary" />
          {erro && <p className="text-sm text-red-500 mt-2">{erro}</p>}
          <button onClick={salvarNovo} disabled={carregando || pinNovo.length !== 4} className="mt-4 w-full rounded-xl bg-primary text-white font-bold py-3 disabled:opacity-50 inline-flex items-center justify-center gap-2">
            {carregando ? <Loader2 size={16} className="animate-spin" /> : 'Salvar novo PIN'}
          </button>
        </>
      )}
    </div>
  );
}

// ════════════════ COFRE (quadros → seções → itens) ════════════════
function Vault({ phone, temPin, onPinChange }: { phone: string; temPin: boolean; onPinChange: (definido: boolean) => void }) {
  const [secao, setSecao] = useState<any | null>(null);
  const [modalPin, setModalPin] = useState(false);

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-6">
      <GrowHero
        badge="Dados Pessoais" badgeIcon={Lock}
        titulo={secao ? secao.nome : 'Dados Pessoais'}
        subtitulo={secao ? 'Suas informações desta seção' : 'Seu cofre pessoal — organizado do seu jeito, só pra você.'}
      >
        <button onClick={() => setModalPin(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold border border-border/60 text-foreground hover:bg-foreground/[0.04] transition-all">
          {temPin ? <ShieldCheck size={15} style={{ color: BRAND }} /> : <ShieldOff size={15} />} {temPin ? 'PIN ativo' : 'Proteger com PIN'}
        </button>
      </GrowHero>

      {!temPin && (
        <button onClick={() => setModalPin(true)} className="w-full flex items-center gap-3 rounded-2xl p-4 border border-primary/20 bg-primary/[0.06] text-left hover:bg-primary/[0.1] transition-colors">
          <Lock size={18} style={{ color: BRAND }} />
          <div><p className="text-sm font-bold text-foreground">Proteger esta aba com um PIN</p>
            <p className="text-xs text-muted-foreground">Um código de 4 dígitos pra ninguém abrir seus dados sem querer.</p></div>
          <ChevronRight size={18} className="ml-auto text-muted-foreground" />
        </button>
      )}

      {secao
        ? <NivelItens phone={phone} secao={secao} onVoltar={() => setSecao(null)} />
        : <Board phone={phone} onAbrirSecao={setSecao} />}

      {modalPin && <ModalPin phone={phone} temPin={temPin} onFechar={() => setModalPin(false)} onMudou={onPinChange} />}
    </div>
  );
}

// ── Visão principal: BOARD (colunas = quadros, cards = seções dentro) ──
// Mostra as seções dentro de cada quadro pai (estilo Notion) pra acessar direto.
function Board({ phone, onAbrirSecao }: { phone: string; onAbrirSecao: (s: any) => void }) {
  const { data: quadrosData, mutate: mutQuadros } = useApi(`dados:quadros:${phone}`, () => api.dados.quadros.listar(phone));
  const { data: secoesData, mutate: mutSecoes } = useApi(`dados:secoes:all:${phone}`, () => api.dados.secoes.listarTodas(phone));
  const [modalQuadro, setModalQuadro] = useState<any | null | undefined>(undefined); // undefined=fechado, null=novo, obj=editar
  const [modalSecao, setModalSecao] = useState<{ quadroId: string; secao?: any } | null>(null);

  const quadros: any[] = quadrosData ?? [];
  const secoes: any[] = secoesData ?? [];
  const loading = quadrosData === undefined || secoesData === undefined;
  const porQuadro: Record<string, any[]> = {};
  for (const s of secoes) (porQuadro[s.quadro_id] = porQuadro[s.quadro_id] || []).push(s);

  const modais = (
    <>
      {modalQuadro !== undefined && <ModalQuadro phone={phone} quadro={modalQuadro} onFechar={() => setModalQuadro(undefined)} onSalvo={() => { setModalQuadro(undefined); mutQuadros(); mutSecoes(); }} />}
      {modalSecao && <ModalSecao phone={phone} quadroId={modalSecao.quadroId} secao={modalSecao.secao || null} onFechar={() => setModalSecao(null)} onSalvo={() => { setModalSecao(null); mutSecoes(); }} />}
    </>
  );

  if (loading) return <Spinner />;
  if (quadros.length === 0) return (
    <>
      <Vazio icone="📁" texto="Crie seu primeiro quadro — ex.: Informações Pessoais, Saúde, Profissional. Dentro dele você adiciona seções (dados bancários, documentos…)." />
      <div className="flex justify-center"><button onClick={() => setModalQuadro(null)} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/25 active:scale-95"><Plus size={16} /> Novo quadro</button></div>
      {modais}
    </>
  );

  return (
    <>
      <div className="flex items-center justify-end">
        <button onClick={() => setModalQuadro(null)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/25 active:scale-95"><Plus size={16} /> Novo quadro</button>
      </div>

      <div className="overflow-x-auto pb-3 -mx-1 px-1 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
        <div className="flex gap-4 items-start" style={{ minWidth: 'min-content' }}>
          {quadros.map((q, i) => {
            const filhas = porQuadro[q.id] || [];
            return (
              <div key={q.id} className="w-[268px] sm:w-[288px] shrink-0 animate-[slide-up_500ms_ease-out_both]" style={{ animationDelay: `${i * 50}ms` }}>
                {/* cabeçalho colorido do quadro */}
                <div className="flex items-center gap-2 mb-2.5 px-0.5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[13px] font-bold text-white shadow-sm max-w-[180px]" style={{ background: q.cor }}>
                    <span className="text-sm leading-none">{q.icone || '📁'}</span>
                    <span className="truncate">{q.nome}</span>
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground tabular-nums">{filhas.length}</span>
                  <div className="ml-auto flex items-center">
                    <button onClick={() => setModalSecao({ quadroId: q.id })} className="p-1.5 rounded-lg text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors" aria-label="Nova seção"><Plus size={15} /></button>
                    <button onClick={() => setModalQuadro(q)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors" aria-label="Editar quadro"><Pencil size={13} /></button>
                  </div>
                </div>
                {/* painel com as seções dentro */}
                <div className="rounded-2xl p-2 border border-border/40 space-y-2" style={{ background: 'hsl(var(--bg-subtle) / 0.4)' }}>
                  {filhas.map(s => (
                    <button key={s.id} onClick={() => onAbrirSecao(s)}
                      className="group w-full text-left flex items-center gap-2.5 rounded-xl px-3 py-2.5 border border-border/40 hover:-translate-y-0.5 hover:border-border transition-all"
                      style={{ background: 'hsl(var(--bg-card) / 0.85)' }}>
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0" style={{ background: `${q.cor}22` }}>{s.icone || '🗂️'}</span>
                      <span className="font-medium text-foreground text-sm leading-tight flex-1 min-w-0 truncate">{s.nome}</span>
                      <span onClick={(e) => { e.stopPropagation(); setModalSecao({ quadroId: q.id, secao: s }); }} className="p-1 rounded text-muted-foreground lg:opacity-0 lg:group-hover:opacity-100 hover:bg-foreground/10 flex-shrink-0"><Pencil size={12} /></span>
                    </button>
                  ))}
                  <button onClick={() => setModalSecao({ quadroId: q.id })} className="w-full flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] transition-colors">
                    <Plus size={15} /> Adicionar seção
                  </button>
                </div>
              </div>
            );
          })}
          {/* coluna pra novo quadro */}
          <button onClick={() => setModalQuadro(null)} className="w-[200px] shrink-0 self-start mt-9 rounded-2xl border border-dashed border-border/60 py-4 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors flex items-center justify-center gap-1.5">
            <Plus size={16} /> Novo quadro
          </button>
        </div>
      </div>
      {modais}
    </>
  );
}

// ── Nível 3: Itens ──
function NivelItens({ phone, secao, onVoltar }: { phone: string; secao: any; onVoltar: () => void }) {
  const { data, mutate } = useApi(`dados:itens:${secao.id}`, () => api.dados.itens.listar(phone, secao.id));
  const [modal, setModal] = useState<any | null | undefined>(undefined);
  const lista: any[] = data ?? [];
  const loading = data === undefined;

  return (
    <>
      <BarraVoltar onVoltar={onVoltar} label="Voltar" acao={() => setModal(null)} acaoLabel="Adicionar" />
      {loading ? <Spinner /> : lista.length === 0 ? (
        <Vazio icone="📝" texto="Nada guardado aqui ainda. Adicione um campo, nota ou senha." />
      ) : (
        <div className="space-y-2.5">
          {lista.map((it, i) => <ItemCard key={it.id} item={it} phone={phone} onEditar={() => setModal(it)} onMudou={mutate} delay={i * 40} />)}
        </div>
      )}
      {modal !== undefined && <ModalItem phone={phone} secaoId={secao.id} item={modal} onFechar={() => setModal(undefined)} onSalvo={() => { setModal(undefined); mutate(); }} />}
    </>
  );
}

function ItemCard({ item, phone, onEditar, onMudou, delay }: { item: any; phone: string; onEditar: () => void; onMudou: () => void; delay: number }) {
  const [revelado, setRevelado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const isSenha = item.tipo === 'senha';
  const isArquivo = item.tipo === 'arquivo';
  const copiar = async () => { try { await navigator.clipboard.writeText(item.valor || ''); setCopiado(true); setTimeout(() => setCopiado(false), 1500); } catch {} };
  const baixar = async () => {
    if (!item.arquivo_url) return; setBaixando(true);
    try { const { url } = await api.dados.arquivo.downloadUrl({ phone, path: item.arquivo_url }); window.open(url, '_blank', 'noopener'); } catch {}
    finally { setBaixando(false); }
  };

  return (
    <div className="group rounded-2xl p-4 border border-border/40 animate-[slide-up_500ms_ease-out_both]" style={{ background: 'hsl(var(--bg-card) / 0.5)', animationDelay: `${delay}ms` }}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {item.titulo && <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{item.titulo}</p>}
          {isArquivo ? (
            <button onClick={baixar} className="inline-flex items-center gap-2 text-foreground font-medium hover:text-primary transition-colors max-w-full">
              <Paperclip size={15} className="flex-shrink-0" style={{ color: BRAND }} />
              <span className="truncate">{item.arquivo_nome || 'arquivo'}</span>
            </button>
          ) : (
            <p className={`text-foreground break-words ${item.tipo === 'nota' ? 'whitespace-pre-wrap text-sm' : 'font-medium'} ${isSenha && !revelado ? 'tracking-widest' : ''}`}>
              {isSenha && !revelado ? '••••••••' : (item.valor || '—')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {isArquivo && <button onClick={baixar} className="p-2 rounded-lg text-muted-foreground hover:bg-foreground/10" aria-label="Baixar">{baixando ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}</button>}
          {isSenha && <button onClick={() => setRevelado(v => !v)} className="p-2 rounded-lg text-muted-foreground hover:bg-foreground/10" aria-label="Mostrar">{revelado ? <EyeOff size={15} /> : <Eye size={15} />}</button>}
          {!isArquivo && item.valor && <button onClick={copiar} className="p-2 rounded-lg text-muted-foreground hover:bg-foreground/10" aria-label="Copiar">{copiado ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}</button>}
          <button onClick={onEditar} className="p-2 rounded-lg text-muted-foreground lg:opacity-0 lg:group-hover:opacity-100 hover:bg-foreground/10" aria-label="Editar"><Pencil size={14} /></button>
        </div>
      </div>
    </div>
  );
}

// ════════════════ Componentes auxiliares ════════════════
function Spinner() { return <div className="py-16 flex items-center justify-center"><Loader2 size={22} className="animate-spin text-primary" /></div>; }
function Vazio({ icone, texto }: { icone: string; texto: string }) {
  return <div className="rounded-3xl border border-dashed border-border/60 p-10 text-center"><div className="text-4xl mb-3">{icone}</div><p className="text-sm text-muted-foreground max-w-xs mx-auto">{texto}</p></div>;
}
function BarraVoltar({ onVoltar, label, acao, acaoLabel }: { onVoltar: () => void; label: string; acao: () => void; acaoLabel: string }) {
  return (
    <div className="flex items-center justify-between">
      <button onClick={onVoltar} className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"><ChevronLeft size={16} /> {label}</button>
      <button onClick={acao} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/25 active:scale-95"><Plus size={16} /> {acaoLabel}</button>
    </div>
  );
}
function ModalShell({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onFechar}>
      <div className="w-full max-w-md bg-card rounded-3xl border border-border shadow-2xl p-5 sm:p-6 animate-[slide-up_300ms_ease-out_both]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-bold text-foreground">{titulo}</h3><button onClick={onFechar} className="p-1.5 rounded-lg text-muted-foreground hover:bg-foreground/10"><X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}
const inputCls = "w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-foreground outline-none focus:border-primary transition-colors";

// ── Modais de CRUD ──
function ModalQuadro({ phone, quadro, onFechar, onSalvo }: any) {
  const ed = quadro || null;
  const [nome, setNome] = useState(ed?.nome || '');
  const [cor, setCor] = useState(ed?.cor || PALETA[0]);
  const [icone, setIcone] = useState(ed?.icone || '📁');
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    if (!nome.trim()) return; setSalvando(true);
    try { ed ? await api.dados.quadros.editar(ed.id, { phone, nome: nome.trim(), cor, icone }) : await api.dados.quadros.criar({ phone, nome: nome.trim(), cor, icone }); onSalvo(); }
    finally { setSalvando(false); }
  };
  const excluir = async () => { if (!ed || !confirm('Excluir este quadro e tudo dentro dele?')) return; await api.dados.quadros.deletar(ed.id, phone); onSalvo(); };
  return (
    <ModalShell titulo={ed ? 'Editar quadro' : 'Novo quadro'} onFechar={onFechar}>
      <label className="text-xs font-semibold text-muted-foreground">Nome</label>
      <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Informações pessoais" className={`${inputCls} mt-1 mb-4`} autoFocus />
      <label className="text-xs font-semibold text-muted-foreground">Cor</label>
      <div className="flex flex-wrap gap-2 mt-1.5 mb-4">{PALETA.map(c => <button key={c} onClick={() => setCor(c)} className="w-8 h-8 rounded-full transition-transform active:scale-90" style={{ background: c, outline: cor === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }} />)}</div>
      <label className="text-xs font-semibold text-muted-foreground">Ícone</label>
      <div className="flex flex-wrap gap-1.5 mt-1.5 mb-5">{ICONES_QUADRO.map(ic => <button key={ic} onClick={() => setIcone(ic)} className={`w-9 h-9 rounded-lg text-lg ${icone === ic ? 'bg-primary/15 ring-1 ring-primary' : 'bg-foreground/[0.04]'}`}>{ic}</button>)}</div>
      <BotoesModal onSalvar={salvar} salvando={salvando} podeExcluir={!!ed} onExcluir={excluir} />
    </ModalShell>
  );
}
function ModalSecao({ phone, quadroId, secao, onFechar, onSalvo }: any) {
  const ed = secao || null;
  const [nome, setNome] = useState(ed?.nome || '');
  const [icone, setIcone] = useState(ed?.icone || '🗂️');
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    if (!nome.trim()) return; setSalvando(true);
    try { ed ? await api.dados.secoes.editar(ed.id, { phone, nome: nome.trim(), icone }) : await api.dados.secoes.criar({ phone, quadro_id: quadroId, nome: nome.trim(), icone }); onSalvo(); }
    finally { setSalvando(false); }
  };
  const excluir = async () => { if (!ed || !confirm('Excluir esta seção e seus itens?')) return; await api.dados.secoes.deletar(ed.id, phone); onSalvo(); };
  return (
    <ModalShell titulo={ed ? 'Editar seção' : 'Nova seção'} onFechar={onFechar}>
      <label className="text-xs font-semibold text-muted-foreground">Nome</label>
      <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Dados bancários" className={`${inputCls} mt-1 mb-4`} autoFocus />
      <label className="text-xs font-semibold text-muted-foreground">Ícone</label>
      <div className="flex flex-wrap gap-1.5 mt-1.5 mb-5">{['🗂️','🏦','🪪','📄','🔑','💳','📇','🏥','📱','✉️'].map(ic => <button key={ic} onClick={() => setIcone(ic)} className={`w-9 h-9 rounded-lg text-lg ${icone === ic ? 'bg-primary/15 ring-1 ring-primary' : 'bg-foreground/[0.04]'}`}>{ic}</button>)}</div>
      <BotoesModal onSalvar={salvar} salvando={salvando} podeExcluir={!!ed} onExcluir={excluir} />
    </ModalShell>
  );
}
function ModalItem({ phone, secaoId, item, onFechar, onSalvo }: any) {
  const ed = item || null;
  const [tipo, setTipo] = useState(ed?.tipo || 'campo');
  const [titulo, setTitulo] = useState(ed?.titulo || '');
  const [valor, setValor] = useState(ed?.valor || '');
  const [arquivoUrl, setArquivoUrl] = useState(ed?.arquivo_url || '');
  const [arquivoNome, setArquivoNome] = useState(ed?.arquivo_nome || '');
  const [uploading, setUploading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const onFile = async (e: any) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 10 * 1024 * 1024) { setErro('Arquivo muito grande (máx. 10 MB).'); return; }
    setUploading(true); setErro('');
    try {
      const { path, token, nome } = await api.dados.arquivo.uploadUrl({ phone, filename: f.name });
      const { error } = await supabase.storage.from('dados-arquivos').uploadToSignedUrl(path, token, f);
      if (error) throw error;
      setArquivoUrl(path); setArquivoNome(nome); if (!titulo.trim()) setTitulo(f.name);
    } catch { setErro('Falha no upload. Tente de novo.'); }
    finally { setUploading(false); }
  };

  const salvar = async () => {
    if (tipo === 'arquivo' && !arquivoUrl) { setErro('Anexe um arquivo.'); return; }
    if (tipo !== 'arquivo' && !valor.trim() && !titulo.trim()) return;
    setSalvando(true); setErro('');
    const body: any = { phone, tipo, titulo: titulo.trim() || null };
    if (tipo === 'arquivo') { body.arquivo_url = arquivoUrl; body.arquivo_nome = arquivoNome; body.valor = null; }
    else body.valor = valor;
    try { ed ? await api.dados.itens.editar(ed.id, body) : await api.dados.itens.criar({ ...body, secao_id: secaoId }); onSalvo(); }
    catch { setErro('Não consegui salvar.'); setSalvando(false); }
  };
  const excluir = async () => { if (!ed || !confirm('Excluir este item?')) return; await api.dados.itens.deletar(ed.id, phone); onSalvo(); };

  return (
    <ModalShell titulo={ed ? 'Editar item' : 'Adicionar item'} onFechar={onFechar}>
      <div className="grid grid-cols-4 gap-1.5 mb-4">
        {TIPOS.map(t => <button key={t.v} onClick={() => setTipo(t.v)} className={`rounded-xl p-2 text-center border transition-all ${tipo === t.v ? 'border-primary bg-primary/10' : 'border-border/50'}`}><t.icon size={15} className="mx-auto mb-1" style={{ color: tipo === t.v ? BRAND : 'hsl(var(--muted-foreground))' }} /><span className="text-[11px] font-semibold text-foreground">{t.l}</span></button>)}
      </div>
      <label className="text-xs font-semibold text-muted-foreground">Rótulo (opcional)</label>
      <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder={tipo === 'arquivo' ? 'Ex.: Currículo 2026' : 'Ex.: Banco, Login, Validade…'} className={`${inputCls} mt-1 mb-4`} />

      {tipo === 'arquivo' ? (
        <>
          <label className="text-xs font-semibold text-muted-foreground">Arquivo (até 10 MB)</label>
          <label className="mt-1 mb-5 flex items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 py-5 cursor-pointer hover:bg-foreground/[0.03] transition-colors text-sm">
            {uploading ? <><Loader2 size={16} className="animate-spin" /> Enviando…</>
              : arquivoUrl ? <><Check size={16} className="text-green-500" /> <span className="truncate max-w-[200px]">{arquivoNome}</span> · trocar</>
              : <><Paperclip size={16} /> Escolher arquivo</>}
            <input type="file" className="hidden" onChange={onFile} disabled={uploading} />
          </label>
        </>
      ) : tipo === 'nota' ? (
        <><label className="text-xs font-semibold text-muted-foreground">Conteúdo</label>
        <textarea value={valor} onChange={e => setValor(e.target.value)} rows={4} className={`${inputCls} mt-1 mb-5 resize-y`} autoFocus /></>
      ) : (
        <><label className="text-xs font-semibold text-muted-foreground">Valor</label>
        <input value={valor} onChange={e => setValor(e.target.value)} className={`${inputCls} mt-1 mb-5`} autoFocus /></>
      )}

      {erro && <p className="text-sm text-red-500 mb-3 -mt-2">{erro}</p>}
      <BotoesModal onSalvar={salvar} salvando={salvando || uploading} podeExcluir={!!ed} onExcluir={excluir} />
    </ModalShell>
  );
}
function BotoesModal({ onSalvar, salvando, podeExcluir, onExcluir }: any) {
  return (
    <div className="flex items-center gap-2">
      {podeExcluir && <button onClick={onExcluir} className="p-2.5 rounded-xl text-red-500 hover:bg-red-500/10" aria-label="Excluir"><Trash2 size={18} /></button>}
      <button onClick={onSalvar} disabled={salvando} className="flex-1 rounded-xl bg-primary text-white font-bold py-3 disabled:opacity-50 inline-flex items-center justify-center gap-2">{salvando ? <Loader2 size={16} className="animate-spin" /> : 'Salvar'}</button>
    </div>
  );
}

// ── Modal de gestão do PIN ──
function ModalPin({ phone, temPin, onFechar, onMudou }: { phone: string; temPin: boolean; onFechar: () => void; onMudou: (d: boolean) => void }) {
  const [pinAtual, setPinAtual] = useState('');
  const [pinNovo, setPinNovo] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    if (!/^\d{4}$/.test(pinNovo)) { setErro('O novo PIN deve ter 4 dígitos.'); return; }
    setSalvando(true); setErro('');
    try { await api.dados.pin.definir({ phone, pinAtual: temPin ? pinAtual : undefined, pinNovo }); onMudou(true); onFechar(); }
    catch (e: any) { setErro(e?.message?.includes('atual') ? 'PIN atual incorreto.' : 'Não consegui salvar.'); }
    finally { setSalvando(false); }
  };
  const remover = async () => {
    if (!/^\d{4}$/.test(pinAtual)) { setErro('Digite o PIN atual pra remover.'); return; }
    setSalvando(true); setErro('');
    try { await api.dados.pin.remover({ phone, pin: pinAtual }); onMudou(false); onFechar(); }
    catch { setErro('PIN incorreto.'); }
    finally { setSalvando(false); }
  };

  return (
    <ModalShell titulo={temPin ? 'Gerenciar PIN' : 'Criar PIN'} onFechar={onFechar}>
      <p className="text-sm text-muted-foreground mb-4">{temPin ? 'Troque ou remova o PIN de 4 dígitos desta aba.' : 'Um código de 4 dígitos pra proteger seus dados pessoais.'}</p>
      {temPin && (
        <><label className="text-xs font-semibold text-muted-foreground">PIN atual</label>
        <input inputMode="numeric" value={pinAtual} onChange={e => setPinAtual(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="• • • •" className={`${inputCls} mt-1 mb-4 text-center text-xl tracking-[0.4em]`} /></>
      )}
      <label className="text-xs font-semibold text-muted-foreground">{temPin ? 'Novo PIN' : 'PIN (4 dígitos)'}</label>
      <input inputMode="numeric" value={pinNovo} onChange={e => setPinNovo(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="• • • •" className={`${inputCls} mt-1 mb-2 text-center text-xl tracking-[0.4em]`} />
      {erro && <p className="text-sm text-red-500 mb-2">{erro}</p>}
      <button onClick={salvar} disabled={salvando} className="mt-3 w-full rounded-xl bg-primary text-white font-bold py-3 disabled:opacity-50 inline-flex items-center justify-center gap-2">{salvando ? <Loader2 size={16} className="animate-spin" /> : (temPin ? 'Salvar novo PIN' : 'Criar PIN')}</button>
      {temPin && <button onClick={remover} disabled={salvando} className="mt-2 w-full rounded-xl border border-border/60 text-red-500 font-semibold py-2.5 hover:bg-red-500/5">Remover PIN</button>}
    </ModalShell>
  );
}
