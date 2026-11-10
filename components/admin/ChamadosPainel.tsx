'use client';

// =============================================================================
// Aba "Chamados" do admin — problemas, dúvidas e melhorias numa lista só.
//
// Pedido do dono (nov/2026): abertos primeiro, finalizado vai pro fim, e saber
// quando o cliente respondeu. A ordem e a situação vêm prontas do servidor
// (lib/chamados-admin, com eval); aqui é só o desenho.
//
// Três blocos, na ordem da urgência:
//   1. Precisam de resposta — quem respondeu e você não leu vem no topo, com
//      selo; depois os que esperam há mais tempo.
//   2. Aguardando o cliente — você respondeu por último.
//   3. Resolvidos — recolhidos: a conversa deles já foi apagada, então só
//      servem de histórico.
//
// Antes eram duas abas (Bugs e Melhorias) sem ordem por situação: um chamado
// "em andamento" cujo cliente acabou de responder ficava no meio da lista,
// igual a um que esperava o cliente.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2, MessageSquare, Send, AlertCircle, CheckCircle2, Clock, Inbox, ChevronDown, RefreshCw,
} from 'lucide-react';
import { useConfirmar } from '@/contexts/ConfirmContext';

type Situacao = 'precisa_resposta' | 'aguardando_cliente' | 'resolvido';
export type Chamado = {
  id: string; nome: string | null; email: string | null; phone: string | null;
  mensagem: string; tem_imagem: boolean; status: 'aberto' | 'em_andamento' | 'resolvido'; created_at: string;
  tipo?: 'problema' | 'melhoria' | 'duvida';
  situacao: Situacao; nao_lidas: number; mensagens: number; ultima_atividade: string;
  ultimo_autor: 'usuario' | 'suporte' | null;
};

// Higiene de formulário, não regra de plataforma: a resposta vai pro painel
// (coluna text); o WhatsApp leva só a campainha. Ver responder-relato.
const LIMITE_RESPOSTA = 6000;

const TIPOS = [
  { id: 'todos', label: 'Todos' },
  { id: 'problema', label: 'Problemas' },
  { id: 'duvida', label: 'Dúvidas' },
  { id: 'melhoria', label: 'Melhorias' },
] as const;

function haQuanto(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (min < 60) return min <= 1 ? 'agora' : `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

export default function ChamadosPainel({ flash, onMudou }: {
  flash: (m: string) => void;
  /** Avisa o pai (contadores do topo e da sidebar) que algo mudou. */
  onMudou?: () => void;
}) {
  const confirmar = useConfirmar();
  const [lista, setLista] = useState<Chamado[] | null>(null);
  const [erro, setErro] = useState('');
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]['id']>('todos');
  const [verResolvidos, setVerResolvidos] = useState(false);
  const [respId, setRespId] = useState<string | null>(null);
  const [respMsg, setRespMsg] = useState('');
  const [enviando, setEnviando] = useState(false);
  // Força a conversa a recarregar depois de responder (ela guarda o que leu).
  const [versao, setVersao] = useState<Record<string, number>>({});

  const carregar = useCallback(async () => {
    setErro('');
    try {
      const r = await fetch('/api/admin/bugs', { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok || d.erro) throw new Error(d.erro || `Erro ${r.status}`);
      setLista(d.bugs || []);
    } catch (e: any) { setErro(e?.message || 'Não consegui carregar os chamados.'); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const filtrada = useMemo(
    () => (lista || []).filter((c) => tipo === 'todos' || (c.tipo || 'problema') === tipo),
    [lista, tipo],
  );
  const grupos = useMemo(() => ({
    precisa: filtrada.filter((c) => c.situacao === 'precisa_resposta'),
    aguardando: filtrada.filter((c) => c.situacao === 'aguardando_cliente'),
    resolvidos: filtrada.filter((c) => c.situacao === 'resolvido'),
  }), [filtrada]);
  const contaTipo = (t: string) => (lista || [])
    .filter((c) => c.situacao !== 'resolvido' && (t === 'todos' || (c.tipo || 'problema') === t)).length;

  // Abrir a conversa marca as do cliente como lidas no servidor; espelha aqui.
  const marcouLido = useCallback((id: string) => {
    setLista((l) => l && l.map((c) => (c.id === id && c.nao_lidas ? { ...c, nao_lidas: 0 } : c)));
    onMudou?.();
  }, [onMudou]);

  async function mudarStatus(c: Chamado, status: Chamado['status']) {
    // ⚠️ "RESOLVIDO" APAGA A CONVERSA E OS ANEXOS, sem volta. Pedido do dono
    // (não guardar print de extrato depois de resolver) — mas tem de avisar.
    if (status === 'resolvido') {
      const ok = await confirmar({
        titulo: 'Encerrar este chamado?',
        mensagem: 'A conversa e os anexos são apagados, sem como desfazer. O relato de abertura fica no histórico e o chamado vai pro fim da lista.',
        confirmar: 'Encerrar', cancelar: 'Voltar', perigo: true,
      });
      if (!ok) return;
    }
    const antes = lista;
    setLista((l) => l && l.map((x) => (x.id === c.id
      ? { ...x, status, situacao: status === 'resolvido' ? 'resolvido' : x.situacao === 'resolvido' ? 'precisa_resposta' : x.situacao }
      : x)));
    try {
      const r = await fetch('/api/admin/bugs', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, status }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.erro || `Erro ${r.status}`);
      await carregar();       // a ordem certa vem do servidor
      onMudou?.();
    } catch (e: any) { setLista(antes); flash('⚠️ ' + (e?.message || 'falhou')); }
  }

  async function responder(c: Chamado) {
    if (!respMsg.trim()) return;
    setEnviando(true);
    try {
      const r = await fetch('/api/admin/responder-relato', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bugId: c.id, texto: respMsg.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      // Só é erro quando a RESPOSTA não foi publicada — a campainha do
      // WhatsApp falhando volta como `aviso` e não invalida nada.
      if (d?.erro) { flash('⚠️ ' + d.erro); return; }
      flash(d?.aviso ? '⚠️ ' + d.aviso : 'Respondido ✓ (avisado no WhatsApp)');
      setRespId(null); setRespMsg('');
      setVersao((v) => ({ ...v, [c.id]: (v[c.id] || 0) + 1 }));
      await carregar();
      onMudou?.();
    } catch (e: any) { flash('⚠️ ' + (e?.message || 'falhou')); }
    finally { setEnviando(false); }
  }

  if (!lista && !erro) {
    return (
      <div className="space-y-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl border border-border animate-pulse" style={{ background: 'hsl(var(--bg-card) / 0.5)' }} />
        ))}
      </div>
    );
  }
  if (erro && !lista) {
    return (
      <div className="rounded-2xl border border-red-300 dark:border-red-900/60 p-5 text-center">
        <p className="text-sm font-semibold text-foreground">{erro}</p>
        <button onClick={carregar} className="mt-3 inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-border text-xs font-bold">
          <RefreshCw size={13} /> Tentar de novo
        </button>
      </div>
    );
  }

  const cartao = (c: Chamado) => {
    const usado = respMsg.trim().length;
    const restante = LIMITE_RESPOSTA - usado;
    const estourou = restante < 0;
    return (
      <article key={c.id}
               className={`rounded-2xl border bg-card p-4 space-y-2 ${c.nao_lidas > 0 ? 'border-primary/60 ring-1 ring-primary/25' : 'border-border'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {c.tipo === 'duvida' && <span className="mr-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/15 text-sky-600 align-middle">Dúvida</span>}
              {c.tipo === 'melhoria' && <span className="mr-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-600 align-middle">Melhoria</span>}
              {c.nome || '—'}
            </p>
            <p className="text-[11px] text-muted-foreground break-all">{c.phone || c.email || ''}</p>
            <p className="text-[11px] text-muted-foreground">
              Aberto em {new Date(c.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              {c.situacao !== 'resolvido' && c.ultima_atividade !== c.created_at ? ` · última mensagem ${haQuanto(c.ultima_atividade)}` : ''}
              {c.tem_imagem ? ' · com print' : ''}
            </p>
          </div>
          {/* Situação: ícone + rótulo, nunca só cor. */}
          {c.nao_lidas > 0 ? (
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary text-white whitespace-nowrap">
              <MessageSquare size={10} /> {c.nao_lidas === 1 ? 'Cliente respondeu' : `${c.nao_lidas} respostas novas`}
            </span>
          ) : c.situacao === 'precisa_resposta' ? (
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-500/15 text-red-600 whitespace-nowrap">
              <AlertCircle size={10} /> {c.mensagens === 0 ? 'Sem resposta' : 'Cliente falou por último'}
            </span>
          ) : c.situacao === 'aguardando_cliente' ? (
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-600 whitespace-nowrap">
              <Clock size={10} /> {c.mensagens === 0 ? 'Sugestão recebida' : 'Aguardando o cliente'}
            </span>
          ) : (
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-600 whitespace-nowrap">
              <CheckCircle2 size={10} /> Resolvido
            </span>
          )}
        </div>
        <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{c.mensagem}</p>

        {c.situacao !== 'resolvido' && (
          <ConversaChamado key={`${c.id}:${versao[c.id] || 0}`} id={c.id} temImagem={c.tem_imagem}
                           qtd={c.mensagens} naoLidas={c.nao_lidas}
                           abrirSozinho={!!versao[c.id]} onLido={() => marcouLido(c.id)} />
        )}

        <div className="flex items-center gap-1.5 pt-1 flex-wrap">
          {c.situacao !== 'resolvido' ? (
            <>
              <button onClick={() => { setRespId(respId === c.id ? null : c.id); setRespMsg(''); }}
                      className={`h-9 px-3 rounded-lg text-[12px] font-bold transition-all border inline-flex items-center gap-1 ${respId === c.id ? 'border-primary text-primary bg-primary/10' : 'border-border text-foreground hover:bg-muted/40'}`}>
                <Send size={12} /> Responder
              </button>
              <button onClick={() => mudarStatus(c, 'resolvido')}
                      className="h-9 px-3 rounded-lg text-[12px] font-bold border border-border text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                <CheckCircle2 size={12} /> Encerrar
              </button>
              {!c.phone && <span className="text-[10px] text-muted-foreground">sem WhatsApp: ele vê a resposta ao abrir a Sora</span>}
            </>
          ) : (
            <button onClick={() => mudarStatus(c, 'aberto')}
                    className="h-9 px-3 rounded-lg text-[12px] font-bold border border-border text-muted-foreground hover:text-foreground">
              Reabrir
            </button>
          )}
        </div>

        {respId === c.id && (
          <div className="pt-2 space-y-2 border-t border-border/60 mt-1">
            <textarea value={respMsg} onChange={(e) => setRespMsg(e.target.value)} rows={3} autoFocus
                      placeholder={`Resposta pra ${c.nome?.split(' ')[0] || 'o cliente'}…`}
                      aria-invalid={estourou}
                      className={`w-full rounded-xl bg-background p-3 text-sm resize-none focus:outline-none ${estourou ? 'border border-red-500' : 'border border-border focus:border-primary'}`} />
            <div className="flex items-center gap-2">
              <button onClick={() => responder(c)} disabled={enviando || !respMsg.trim() || estourou}
                      className="h-10 px-4 rounded-xl bg-primary hover:opacity-90 text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
                {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar resposta
              </button>
              <button onClick={() => { setRespId(null); setRespMsg(''); }} className="h-10 px-3 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground">Cancelar</button>
              {(estourou || restante <= 500) && (
                <span className={`ml-auto text-[11px] font-semibold tabular-nums inline-flex items-center gap-1 ${estourou ? 'text-red-500' : 'text-amber-500'}`}>
                  {estourou && <AlertCircle size={12} />}{estourou ? `${-restante} a mais` : `${restante} restantes`}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              A resposta aparece no painel do cliente{c.phone ? '; no WhatsApp ele recebe só um aviso com o link.' : '.'}
            </p>
          </div>
        )}
      </article>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TIPOS.map((t) => (
          <button key={t.id} onClick={() => setTipo(t.id)} aria-pressed={tipo === t.id}
                  className={`h-9 px-3 rounded-xl text-xs font-bold whitespace-nowrap border flex-shrink-0 ${tipo === t.id ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground hover:text-foreground'}`}>
            {t.label}{contaTipo(t.id) > 0 && <span className="ml-1 tabular-nums opacity-70">{contaTipo(t.id)}</span>}
          </button>
        ))}
        <button onClick={carregar} className="ml-auto h-9 px-3 rounded-xl border border-border text-[11px] font-bold text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 flex-shrink-0">
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      <Bloco titulo="Precisam de resposta" n={grupos.precisa.length}
             vazio="Ninguém esperando por você. 🎉">
        {grupos.precisa.map(cartao)}
      </Bloco>
      <Bloco titulo="Aguardando o cliente" n={grupos.aguardando.length} vazio="Nenhum chamado esperando o cliente.">
        {grupos.aguardando.map(cartao)}
      </Bloco>

      {grupos.resolvidos.length > 0 && (
        <section className="space-y-2.5">
          <button onClick={() => setVerResolvidos((v) => !v)} aria-expanded={verResolvidos}
                  className="w-full flex items-center justify-between gap-2 h-11 px-3 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:text-foreground">
            <span>Resolvidos <span className="tabular-nums font-semibold">({grupos.resolvidos.length})</span></span>
            <ChevronDown size={15} className={`transition-transform ${verResolvidos ? 'rotate-180' : ''}`} />
          </button>
          {verResolvidos && grupos.resolvidos.map(cartao)}
        </section>
      )}
    </div>
  );
}

function Bloco({ titulo, n, vazio, children }: { titulo: string; n: number; vazio: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="text-sm font-bold text-foreground">
        {titulo} <span className="tabular-nums text-muted-foreground font-semibold">({n})</span>
      </h3>
      {n === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-5 text-center text-[13px] text-muted-foreground flex items-center justify-center gap-2">
          <Inbox size={15} /> {vazio}
        </div>
      ) : children}
    </section>
  );
}

// ─── Conversa de um chamado (visão do suporte) ───────────────────────────────
//
// Carrega SOB DEMANDA: a URL do anexo é assinada e expira em 1h, e a thread só
// interessa no chamado que o admin abriu. Abrir marca as do cliente como lidas
// (o servidor faz isso no GET) — por isso o `onLido`.
function ConversaChamado({ id, temImagem, qtd, naoLidas, abrirSozinho, onLido }: {
  id: string; temImagem?: boolean; qtd: number; naoLidas: number; abrirSozinho?: boolean; onLido: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState<{
    chamado: { imagem_url: string | null };
    mensagens: { id: string; autor: 'usuario' | 'suporte'; texto: string; created_at: string; imagem_url: string | null }[];
  } | null>(null);
  const [carregando, setCarregando] = useState(false);

  const abrir = useCallback(async () => {
    setAberto(true);
    setCarregando(true);
    try {
      const r = await fetch(`/api/admin/bugs/${id}`, { cache: 'no-store' });
      setDados(await r.json());
      if (naoLidas > 0) onLido();
    } catch { /* mostra vazio */ }
    finally { setCarregando(false); }
  }, [id, naoLidas, onLido]);

  // Depois de responder, a conversa reabre já com a resposta nova.
  useEffect(() => { if (abrirSozinho) abrir(); }, [abrirSozinho]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="pt-1">
      <button onClick={() => (aberto ? setAberto(false) : abrir())} aria-expanded={aberto}
              className="inline-flex items-center gap-1.5 h-8 text-[12px] font-bold text-muted-foreground hover:text-foreground transition-colors">
        <MessageSquare size={12} />
        {aberto ? 'Ocultar conversa' : qtd > 0 ? `Ver conversa (${qtd})` : temImagem ? 'Ver print' : 'Ver conversa'}
      </button>

      {aberto && (
        <div className="mt-2 rounded-xl border border-border/60 bg-background/50 p-3 space-y-2">
          {carregando && <Loader2 size={14} className="animate-spin text-muted-foreground mx-auto" />}
          {dados?.chamado?.imagem_url && (
            <a href={dados.chamado.imagem_url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-border">
              <img src={dados.chamado.imagem_url} alt="Print anexado pelo cliente" className="w-full max-h-72 object-contain bg-muted" />
            </a>
          )}
          {!carregando && temImagem && !dados?.chamado?.imagem_url && (
            <p className="text-[11px] text-muted-foreground italic">Print não guardado (relato anterior ao histórico de anexos). Veja no seu WhatsApp.</p>
          )}
          {!carregando && (dados?.mensagens?.length ?? 0) === 0 && (
            <p className="text-[11px] text-muted-foreground">Nenhuma resposta ainda.</p>
          )}
          {dados?.mensagens?.map((m) => (
            <div key={m.id} className={`flex ${m.autor === 'suporte' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 ${m.autor === 'suporte' ? 'bg-primary/12 border border-primary/25' : 'bg-muted border border-border'}`}>
                <p className="text-[10px] font-bold text-muted-foreground mb-0.5">{m.autor === 'suporte' ? 'Você' : 'Cliente'}</p>
                <p className="text-[13px] text-foreground whitespace-pre-wrap break-words leading-relaxed">{m.texto}</p>
                {m.imagem_url && (
                  <a href={m.imagem_url} target="_blank" rel="noopener noreferrer" className="block mt-1.5 rounded-lg overflow-hidden border border-border">
                    <img src={m.imagem_url} alt="Anexo do cliente" className="w-full max-h-52 object-contain bg-background" />
                  </a>
                )}
                <p className="text-[10px] text-muted-foreground mt-1 text-right tabular-nums">
                  {new Date(m.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
