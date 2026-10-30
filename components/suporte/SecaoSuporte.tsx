'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Suporte — dentro da aba Ajuda (out/2026).
//
// Era a aba "Relatar um problema" (/reportar-bug), que pouca gente achava:
// relato do Robert, "difícil achar os chamados". A conversa e o formulário são
// OS MESMOS de antes (MeusChamados + POST /api/bug); o que mudou é o lugar, e
// ganhou uma terceira porta: "Tirar uma dúvida" (migration 191).
//
// ⚠️ Quando há resposta nova do suporte, os chamados vêm PRIMEIRO: foi a
// resposta que trouxe a pessoa até aqui (o selo no "Ajuda" do menu).
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState } from 'react';
import { api, type TipoChamado } from '@/lib/api';
import MeusChamados from '@/components/suporte/MeusChamados';
import { useChamadosNaoLidos } from '@/lib/useChamadosNaoLidos';
import {
  Bug, Lightbulb, HelpCircle, ChevronRight, ChevronLeft, ImagePlus, X, Loader2,
  CheckCircle2, AlertCircle, Send, Mail,
} from 'lucide-react';

const BRAND = 'hsl(var(--primary))';
const MAX_IMG = 6 * 1024 * 1024; // 6MB (cabe no limite de 10MB do backend após base64)

const TIPOS: Record<TipoChamado, {
  Icone: typeof Bug; titulo: string; resumo: string; pergunta: string; placeholder: string;
  anexo: string; enviar: string; enviado: string; obrigado: string; outro: string;
}> = {
  problema: {
    Icone: Bug,
    titulo: 'Relatar um problema',
    resumo: 'Algo não funciona ou parece errado',
    pergunta: 'O que aconteceu?',
    placeholder: "Ex.: Quando eu clico em 'Salvar conta' o botão não faz nada. Acontece sempre que…",
    anexo: 'Print da tela',
    enviar: 'Enviar relato',
    enviado: 'Relato enviado',
    obrigado: 'O time já vai dar uma olhada. A resposta aparece aqui, em Meus chamados, e a gente avisa no WhatsApp.',
    outro: 'Relatar outro problema',
  },
  melhoria: {
    Icone: Lightbulb,
    titulo: 'Sugerir uma melhoria',
    resumo: 'Uma ideia ou algo que faz falta',
    pergunta: 'Qual a sua ideia?',
    placeholder: 'Ex.: Seria ótimo poder exportar minhas transações em PDF. Ou: queria uma categoria pra assinaturas…',
    anexo: 'Imagem de referência',
    enviar: 'Enviar sugestão',
    enviado: 'Sugestão enviada',
    obrigado: 'Toda sugestão é lida e ajuda a decidir o que vem por aí. Se respondermos, aparece aqui em Meus chamados.',
    outro: 'Sugerir outra melhoria',
  },
  duvida: {
    Icone: HelpCircle,
    titulo: 'Tirar uma dúvida',
    resumo: 'Não sabe como fazer algo na Sora',
    pergunta: 'Qual a sua dúvida?',
    placeholder: 'Ex.: Como divido uma conta com outra pessoa? Ou: por que a fatura aparece diferente do app do banco?',
    anexo: 'Print da tela',
    enviar: 'Enviar dúvida',
    enviado: 'Dúvida enviada',
    obrigado: 'A resposta aparece aqui, em Meus chamados, e a gente avisa no WhatsApp quando chegar.',
    outro: 'Enviar outra dúvida',
  },
};
const ORDEM: TipoChamado[] = ['problema', 'melhoria', 'duvida'];

export default function SecaoSuporte({ tipoInicial, chamadoNoLink, onVerDicas }: {
  /** Abre direto num formulário (links antigos: /reportar-bug?aba=problema). */
  tipoInicial?: TipoChamado | null;
  /** Veio por link de um chamado (`?chamado=`): a conversa abre no topo. */
  chamadoNoLink?: boolean;
  /** Leva pra "Vídeos e dicas" — muita dúvida já tem resposta lá. */
  onVerDicas?: () => void;
}) {
  const { naoLidas, carregado } = useChamadosNaoLidos();
  // ⚠️ A POSIÇÃO DOS CHAMADOS É DECIDIDA UMA VEZ, na primeira leitura. Abrir a
  // conversa marca a resposta como lida e o contador zera; se a lista mudasse
  // de lugar por isso, o React a recriaria e FECHARIA a conversa no meio da
  // leitura.
  const [chamadosNoTopo, setChamadosNoTopo] = useState<boolean | null>(chamadoNoLink ? true : null);
  if (chamadosNoTopo === null && carregado) setChamadosNoTopo(naoLidas > 0);
  const noTopo = chamadosNoTopo === true;
  const [tipo, setTipo] = useState<TipoChamado | null>(tipoInicial ?? null);

  const [mensagem, setMensagem] = useState('');
  const [imagem, setImagem] = useState<string | null>(null); // data URI base64
  const [imagemNome, setImagemNome] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const topoRef = useRef<HTMLDivElement>(null);
  // Recarrega a lista quando um chamado novo entra — senão ele só aparecia no próximo F5.
  const recarregarChamados = useRef<(() => void) | null>(null);

  function limpar() {
    setMensagem(''); setImagem(null); setImagemNome(''); setErro(''); setEnviado(false);
  }
  function abrir(t: TipoChamado | null) {
    limpar(); setTipo(t);
    // No celular as opções e o formulário ocupam a tela toda: volta ao topo da
    // seção pra o título do que foi escolhido não ficar fora de vista.
    requestAnimationFrame(() => topoRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  }

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite reanexar o mesmo arquivo
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErro('Anexe uma imagem (PNG, JPG, WEBP).'); return; }
    if (file.size > MAX_IMG) { setErro('Imagem muito grande: o máximo é 6MB.'); return; }
    setErro('');
    const reader = new FileReader();
    reader.onload = () => { setImagem(reader.result as string); setImagemNome(file.name); };
    reader.readAsDataURL(file);
  }

  async function enviar() {
    if (!tipo || !mensagem.trim() || enviando) return;
    setEnviando(true); setErro('');
    try {
      await api.bug.reportar({ mensagem: mensagem.trim(), imagem: imagem || undefined, tipo });
      setEnviado(true);
      recarregarChamados.current?.();
    } catch (e) {
      setErro((e as Error)?.message || 'Não consegui enviar. Tente de novo em instantes.');
    } finally {
      setEnviando(false);
    }
  }

  const chamados = <MeusChamados recarregarRef={recarregarChamados} />;
  const cfg = tipo ? TIPOS[tipo] : null;

  return (
    <div ref={topoRef} className="space-y-6 scroll-mt-4">
      {/* Resposta nova esperando: a conversa vem antes de tudo. */}
      {noTopo && chamados}

      {!cfg ? (
        <section aria-labelledby="suporte-opcoes" className="space-y-3">
          <div>
            <h2 id="suporte-opcoes" className="text-lg font-bold text-foreground">Como podemos ajudar?</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Escolha o assunto. A conversa continua aqui no painel.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {ORDEM.map((t) => {
              const { Icone, titulo, resumo } = TIPOS[t];
              return (
                <button key={t} type="button" onClick={() => abrir(t)}
                  className="group w-full text-left rounded-2xl bg-card p-4 min-h-[64px] flex items-center gap-3 sm:flex-col sm:items-start sm:gap-3
                             hover:bg-muted/40 active:scale-[0.99] transition-[background-color,transform]"
                  style={{ border: '1px solid hsl(var(--border))' }}>
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `color-mix(in srgb, ${BRAND} 12%, transparent)` }}>
                    <Icone size={18} style={{ color: BRAND }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-foreground">{titulo}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5 leading-snug">{resumo}</span>
                  </span>
                  <ChevronRight size={16} className="text-muted-foreground flex-shrink-0 sm:hidden" />
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <section aria-labelledby="suporte-form" className="space-y-4">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => abrir(null)} aria-label="Voltar aos assuntos"
                    className="w-11 h-11 rounded-xl flex items-center justify-center bg-card hover:bg-muted transition-colors flex-shrink-0"
                    style={{ border: '1px solid hsl(var(--border))' }}>
              <ChevronLeft size={18} className="text-foreground" />
            </button>
            <div className="min-w-0">
              <h2 id="suporte-form" className="text-lg font-bold text-foreground leading-tight">{cfg.titulo}</h2>
              <p className="text-xs text-muted-foreground">{cfg.resumo}</p>
            </div>
          </div>

          {enviado ? (
            <div className="rounded-3xl p-6 sm:p-8 text-center animate-fade-in"
                 style={{
                   border: `1px solid color-mix(in srgb, ${BRAND} 25%, transparent)`,
                   background: `color-mix(in srgb, ${BRAND} 5%, transparent)`,
                 }}>
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3 shadow-lg"
                   style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}>
                <CheckCircle2 size={26} className="text-white" />
              </div>
              <h3 className="text-lg font-bold text-foreground">{cfg.enviado}</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto leading-relaxed">{cfg.obrigado}</p>
              <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2">
                <button onClick={limpar}
                        className="inline-flex items-center justify-center h-11 px-5 rounded-xl text-sm font-bold text-white shadow-sm"
                        style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}>
                  {cfg.outro}
                </button>
                <button onClick={() => abrir(null)} className="btn-ghost h-11 px-5 text-sm">Outro assunto</button>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl bg-card p-4 sm:p-6 space-y-4" style={{ border: '1px solid hsl(var(--border))' }}>
              {tipo === 'duvida' && onVerDicas && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Muita resposta já está em{' '}
                  <button type="button" onClick={onVerDicas} className="font-semibold text-primary underline underline-offset-2">
                    Vídeos e dicas
                  </button>. Se não achar, escreva aqui.
                </p>
              )}

              <div className="space-y-1.5">
                <label htmlFor="suporte-msg" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  {cfg.pergunta}
                </label>
                <textarea
                  id="suporte-msg"
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  rows={6}
                  maxLength={4000}
                  placeholder={cfg.placeholder}
                  className="w-full px-3.5 py-3 rounded-2xl bg-background text-base sm:text-sm leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none resize-y min-h-[120px]"
                  style={{ border: '1px solid hsl(var(--border))' }}
                />
                <p className="text-[11px] text-muted-foreground text-right tabular-nums">{mensagem.length}/4000</p>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  {cfg.anexo} <span className="font-medium normal-case tracking-normal opacity-70">(opcional)</span>
                </span>
                {imagem ? (
                  <div className="relative rounded-2xl overflow-hidden bg-muted/30" style={{ border: '1px solid hsl(var(--border))' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagem} alt={imagemNome || 'Imagem anexada'} className="w-full max-h-72 object-contain" />
                    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-card/80"
                         style={{ borderTop: '1px solid hsl(var(--border))' }}>
                      <span className="text-xs text-muted-foreground truncate">{imagemNome}</span>
                      <button onClick={() => { setImagem(null); setImagemNome(''); }}
                              className="inline-flex items-center gap-1 h-11 px-3 rounded-lg text-xs font-semibold text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                              aria-label="Remover imagem">
                        <X size={14} /> Remover
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => fileRef.current?.click()}
                          className="w-full p-4 min-h-[56px] rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2">
                    <ImagePlus size={16} /> Anexar imagem
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" onChange={onPickImage} className="hidden" />
              </div>

              {erro && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/40" role="alert"
                     style={{ border: '1px solid rgb(254 202 202 / 0.8)' }}>
                  <AlertCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 dark:text-red-400">{erro}</p>
                </div>
              )}

              <button onClick={enviar} disabled={!mensagem.trim() || enviando}
                      className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-2xl text-white text-sm font-bold shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]"
                      style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}>
                {enviando ? <><Loader2 size={17} className="animate-spin" /> Enviando…</> : <><Send size={16} /> {cfg.enviar}</>}
              </button>
            </div>
          )}
        </section>
      )}

      {/* Sem resposta nova, os chamados ficam DEPOIS das opções: aí a pessoa
          veio abrir um assunto, e a lista é consulta. Some sozinha quando não
          há chamado nenhum. */}
      {!noTopo && chamados}

      <div className="flex items-start gap-3 p-4 rounded-2xl bg-card/60" style={{ border: '1px solid hsl(var(--border))' }}>
        <Mail size={18} className="text-muted-foreground flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Prefere e-mail? Escreva pra{' '}
          <a href="mailto:contato@forsora.com" className="font-semibold text-foreground hover:underline">contato@forsora.com</a>.
        </p>
      </div>
    </div>
  );
}
