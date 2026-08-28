'use client';

// ─────────────────────────────────────────────────────────────────────────────
// "Meus chamados" — a conversa do suporte dentro do painel.
//
// Antes, o relato era mão única: o cliente escrevia, a resposta chegava por
// WhatsApp e se perdia no meio das outras mensagens. Aqui ela fica: ele reabre
// o chamado e relê o que foi dito, sem depender de rolar o histórico do zap.
//
// ⚠️ O ANEXO VEM COMO URL ASSINADA e temporária (1h). O bucket é privado
// porque print de bug quase sempre mostra saldo e extrato — por isso a imagem
// é recarregada a cada abertura do chamado, e não guardada no estado.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type ChamadoResumo, type ChamadoMensagem, type ChamadoDetalhe } from '@/lib/api';
import {
  MessageSquare, Send, Loader2, ChevronLeft, CheckCircle2, Clock,
  Paperclip, X, Bug, Lightbulb,
} from 'lucide-react';

const MAX_IMG = 6 * 1024 * 1024;

const STATUS = {
  aberto:       { label: 'Aberto',       cor: '#f59e0b', Icon: Clock },
  em_andamento: { label: 'Em andamento', cor: '#0ea5e9', Icon: MessageSquare },
  resolvido:    { label: 'Resolvido',    cor: '#10b981', Icon: CheckCircle2 },
} as const;

const dataCurta = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export default function MeusChamados({ recarregarRef }: { recarregarRef?: React.MutableRefObject<(() => void) | null> }) {
  const [lista, setLista]   = useState<ChamadoResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await api.bug.meusChamados();
      setLista(r.chamados || []);
    } catch { /* sem chamados / migration pendente */ }
    finally { setCarregando(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  // Deixa o pai (a tela de relato) recarregar a lista ao enviar um relato novo.
  useEffect(() => { if (recarregarRef) recarregarRef.current = carregar; }, [recarregarRef, carregar]);

  if (carregando) {
    return <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>;
  }
  if (!lista.length) return null;

  if (aberto) {
    return <Conversa id={aberto} onVoltar={() => { setAberto(null); carregar(); }} />;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
        <MessageSquare size={15} className="text-primary" /> Meus chamados
      </h2>
      <div className="space-y-2">
        {lista.map((c) => {
          const st = STATUS[c.status] || STATUS.aberto;
          const TipoIcon = c.tipo === 'melhoria' ? Lightbulb : Bug;
          return (
            <button key={c.id} onClick={() => setAberto(c.id)}
                    className="w-full text-left rounded-2xl border border-border bg-card p-4 hover:bg-muted/50 transition-colors active:scale-[0.99]">
              <div className="flex items-start gap-3">
                <TipoIcon size={15} className="text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground line-clamp-2 leading-snug">{c.mensagem}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {/* Ícone + rótulo: o status nunca vive só na cor. */}
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: `color-mix(in srgb, ${st.cor} 15%, transparent)`, color: st.cor }}>
                      <st.Icon size={10} /> {st.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{dataCurta(c.created_at)}</span>
                    {c.nao_lidas > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary text-white">
                        {c.nao_lidas} {c.nao_lidas === 1 ? 'nova' : 'novas'}
                      </span>
                    )}
                  </div>
                  {c.ultima_msg && (
                    <p className="text-[12px] text-muted-foreground mt-1.5 truncate">
                      <b>{c.ultima_msg.autor === 'suporte' ? 'Suporte' : 'Você'}:</b> {c.ultima_msg.texto}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ─── Conversa de um chamado ─────────────────────────────────────────────────
function Conversa({ id, onVoltar }: { id: string; onVoltar: () => void }) {
  const [dados, setDados] = useState<{ chamado: ChamadoDetalhe; mensagens: ChamadoMensagem[] } | null>(null);
  const [texto, setTexto] = useState('');
  const [imagem, setImagem] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const fimRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    try { setDados(await api.bug.conversa(id)); }
    catch (e: any) { setErro(e?.message || 'Não consegui abrir o chamado.'); }
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);
  // Rola pro fim quando a conversa cresce — a mensagem nova é o que interessa.
  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [dados?.mensagens.length]);

  function anexar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErro('Anexe uma imagem (PNG, JPG, WEBP).'); return; }
    if (file.size > MAX_IMG) { setErro('Imagem muito grande — máximo 6MB.'); return; }
    setErro('');
    const reader = new FileReader();
    reader.onload = () => setImagem(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function enviar() {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true); setErro('');
    try {
      await api.bug.responder(id, { texto: t, imagem: imagem || undefined });
      setTexto(''); setImagem(null);
      await carregar();
    } catch (e: any) {
      setErro(e?.message || 'Não consegui enviar. Tente de novo.');
    } finally { setEnviando(false); }
  }

  if (!dados) {
    return (
      <div className="flex justify-center py-10">
        {erro ? <p className="text-sm text-muted-foreground">{erro}</p>
              : <Loader2 size={20} className="animate-spin text-muted-foreground" />}
      </div>
    );
  }

  const { chamado, mensagens } = dados;
  const st = STATUS[chamado.status] || STATUS.aberto;
  const encerrado = chamado.status === 'resolvido';

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <button onClick={onVoltar} aria-label="Voltar aos chamados"
                className="w-9 h-9 rounded-xl flex items-center justify-center border border-border bg-card hover:bg-muted transition-colors flex-shrink-0">
          <ChevronLeft size={16} className="text-foreground" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">Chamado #{id.slice(0, 8)}</p>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full mt-0.5"
                style={{ background: `color-mix(in srgb, ${st.cor} 15%, transparent)`, color: st.cor }}>
            <st.Icon size={10} /> {st.label}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3 max-h-[55vh] overflow-y-auto">
        {/* Relato de abertura — sempre o primeiro balão */}
        <Balao autor="usuario" texto={chamado.mensagem} quando={chamado.created_at} imagem={chamado.imagem_url} />
        {mensagens.map((m) => (
          <Balao key={m.id} autor={m.autor} texto={m.texto} quando={m.created_at} imagem={m.imagem_url} />
        ))}
        <div ref={fimRef} />
      </div>

      {encerrado ? (
        // ⚠️ Encerrado = a conversa foi limpa do servidor. Dizer isso é melhor
        // que deixar um campo de texto que responderia 409 ao ser usado.
        <p className="text-[13px] text-muted-foreground text-center py-2 leading-relaxed">
          Este chamado foi encerrado. Se o problema voltar, abra um relato novo acima. 👆
        </p>
      ) : (
        <div className="space-y-2">
          {imagem && (
            <div className="relative rounded-xl overflow-hidden border border-border">
              <img src={imagem} alt="Anexo a enviar" className="w-full max-h-48 object-contain bg-muted" />
              <button onClick={() => setImagem(null)} aria-label="Remover anexo"
                      className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-black/60 text-white flex items-center justify-center">
                <X size={15} />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <input ref={fileRef} type="file" accept="image/*" onChange={anexar} className="hidden" />
            <button onClick={() => fileRef.current?.click()} aria-label="Anexar imagem"
                    className="w-11 h-11 rounded-xl flex items-center justify-center border border-border bg-card hover:bg-muted transition-colors flex-shrink-0">
              <Paperclip size={16} className="text-muted-foreground" />
            </button>
            <textarea
              value={texto} onChange={(e) => setTexto(e.target.value)} rows={1}
              placeholder="Escreva sua resposta…"
              className="flex-1 min-h-[44px] max-h-32 rounded-xl border border-border bg-card px-3 py-3 text-sm text-foreground resize-y focus:outline-none focus:border-primary"
            />
            <button onClick={enviar} disabled={!texto.trim() || enviando} aria-label="Enviar resposta"
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-white flex-shrink-0 disabled:opacity-40 transition-opacity"
                    style={{ background: 'hsl(var(--primary))' }}>
              {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      )}

      {erro && <p className="text-[13px] text-red-500">{erro}</p>}
    </section>
  );
}

function Balao({ autor, texto, quando, imagem }: {
  autor: 'usuario' | 'suporte'; texto: string; quando: string; imagem?: string | null;
}) {
  const meu = autor === 'usuario';
  return (
    <div className={`flex ${meu ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
        meu ? 'bg-primary/12 border border-primary/25' : 'bg-muted border border-border'}`}>
        {/* Autor por escrito: quem lê num print (ou com leitor de tela) não
            distingue lado nem cor. */}
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
          {meu ? 'Você' : 'Suporte Sora'}
        </p>
        <p className="text-[14px] text-foreground leading-relaxed whitespace-pre-wrap break-words">{texto}</p>
        {imagem && (
          <a href={imagem} target="_blank" rel="noopener noreferrer"
             className="block mt-2 rounded-xl overflow-hidden border border-border">
            <img src={imagem} alt="Anexo do chamado" className="w-full max-h-60 object-contain bg-background" />
          </a>
        )}
        <p className="text-[10px] text-muted-foreground mt-1.5 text-right tabular-nums">{hora(quando)}</p>
      </div>
    </div>
  );
}
