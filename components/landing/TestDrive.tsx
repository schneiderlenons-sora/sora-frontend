'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Play, Sparkles } from 'lucide-react';
import IPhoneFrame from './IPhoneFrame';
import { CATEGORIAS, type MsgUser, type MsgSora, type Conversa } from './testdrive-data';

const BRAND = '#61ce70';

type MsgRender =
  | { lado: 'user'; msg: MsgUser; hora: string; idx: number }
  | { lado: 'sora'; msg: MsgSora; hora: string; idx: number }
  | { lado: 'typing'; idx: number };

export default function TestDrive() {
  const [catId, setCatId]         = useState(CATEGORIAS[0].id);
  const [mensagens, setMensagens] = useState<MsgRender[]>([
    { lado: 'sora', msg: { tipo: 'text', texto: 'Oi! Sou a Sora 👋\nQuer testar? Toque numa das mensagens abaixo:' }, hora: '9:41', idx: 0 },
  ]);
  const [ocupada, setOcupada] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const categoria = CATEGORIAS.find(c => c.id === catId)!;

  // Auto-scroll quando mensagem nova
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [mensagens]);

  function horaAgora() {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  async function enviarConversa(conv: Conversa) {
    if (ocupada) return;
    setOcupada(true);

    // Envia a mensagem do usuário
    const next = [...mensagens, { lado: 'user' as const, msg: conv.user, hora: horaAgora(), idx: Date.now() }];
    setMensagens(next);

    // Pequena pausa antes de mostrar typing
    await sleep(500);

    // Mostra typing
    setMensagens(curr => [...curr, { lado: 'typing' as const, idx: Date.now() + 1 }]);
    await sleep(1100);

    // Remove typing, adiciona respostas da Sora uma por uma
    setMensagens(curr => curr.filter(m => m.lado !== 'typing'));

    for (let i = 0; i < conv.sora.length; i++) {
      await sleep(i === 0 ? 200 : 700);
      setMensagens(curr => [...curr, { lado: 'sora' as const, msg: conv.sora[i], hora: horaAgora(), idx: Date.now() + 100 + i }]);
    }

    setOcupada(false);
  }

  function resetar() {
    setMensagens([
      { lado: 'sora', msg: { tipo: 'text', texto: 'Oi! Sou a Sora 👋\nQuer testar? Toque numa das mensagens abaixo:' }, hora: horaAgora(), idx: Date.now() },
    ]);
    setOcupada(false);
  }

  return (
    <section id="demo" className="relative py-24 lg:py-36 border-t border-zinc-200/50 dark:border-white/[0.04]">

      {/* BG glow */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-25 dark:opacity-15"
             style={{ background: `radial-gradient(ellipse, ${BRAND}30 0%, transparent 60%)` }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">

        {/* Cabeçalho */}
        <div className="text-center mb-12 lg:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 border border-zinc-200 dark:border-white/[0.08] bg-zinc-100/60 dark:bg-white/[0.03] backdrop-blur-sm">
            <Sparkles size={11} style={{ color: BRAND }} />
            <span className="text-[11px] font-bold tracking-widest uppercase text-zinc-700 dark:text-white/70">
              Teste agora
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-[-0.03em] max-w-3xl mx-auto">
            Converse com a Sora.<br />
            <span className="text-zinc-400 dark:text-white/30">Sem criar conta.</span>
          </h2>
          <p className="mt-6 text-lg text-zinc-600 dark:text-white/60 max-w-2xl mx-auto">
            Escolha uma mensagem abaixo. Sora responde como faria no seu WhatsApp.
          </p>
        </div>

        {/* Grid: phone (esquerda) + controles (direita) */}
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-8 lg:gap-12 items-start">

          {/* iPhone */}
          <div className="mx-auto w-full max-w-[340px] lg:max-w-[380px] lg:sticky lg:top-24">
            <IPhoneFrame>
              <WhatsAppChat mensagens={mensagens} scrollRef={scrollRef} />
            </IPhoneFrame>
          </div>

          {/* Painel direito */}
          <div>
            {/* Tabs categorias */}
            <div className="flex flex-wrap gap-2 mb-5">
              {CATEGORIAS.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCatId(c.id)}
                  disabled={ocupada}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50 ${
                    catId === c.id
                      ? 'text-white shadow-md'
                      : 'text-zinc-700 dark:text-white/70 bg-zinc-100/80 dark:bg-white/[0.04] border border-zinc-200/60 dark:border-white/[0.06] hover:border-zinc-300 dark:hover:border-white/[0.12]'
                  }`}
                  style={catId === c.id ? { background: `linear-gradient(135deg, ${c.cor} 0%, ${escurecer(c.cor)} 100%)` } : {}}
                >
                  <span className="text-sm">{c.emoji}</span> {c.label}
                </button>
              ))}
            </div>

            {/* Quick replies */}
            <div className="space-y-2 mb-5">
              {categoria.conversas.map((c, i) => (
                <button
                  key={c.titulo}
                  onClick={() => enviarConversa(c.conversa)}
                  disabled={ocupada}
                  className="group w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-white/60 dark:bg-white/[0.02] hover:border-zinc-300 dark:hover:border-white/[0.14] hover:bg-white dark:hover:bg-white/[0.04] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                       style={{ background: `${categoria.cor}15` }}>
                    {c.titulo.startsWith('📷') ? '📷' : c.titulo.startsWith('🎤') ? '🎤' : categoria.emoji}
                  </div>
                  <p className="flex-1 text-sm font-medium text-zinc-900 dark:text-white truncate">
                    "{c.titulo.replace(/^📷 |^🎤 /, '')}"
                  </p>
                  <Play size={13} className="text-zinc-400 dark:text-white/30 group-hover:text-zinc-700 dark:group-hover:text-white transition-colors flex-shrink-0" />
                </button>
              ))}
            </div>

            {/* Reset */}
            {mensagens.length > 1 && (
              <button
                onClick={resetar}
                disabled={ocupada}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-500 dark:text-white/50 hover:text-zinc-900 dark:hover:text-white transition-colors disabled:opacity-50"
              >
                <RefreshCw size={12} /> Limpar conversa
              </button>
            )}

            {/* CTA inferior */}
            <div className="mt-10 p-6 rounded-2xl border border-zinc-200 dark:border-white/[0.08] bg-gradient-to-br from-zinc-50 to-white dark:from-white/[0.03] dark:to-transparent">
              <p className="text-sm text-zinc-600 dark:text-white/60 mb-3">
                Isso é uma simulação. A Sora real entende qualquer pergunta — texto, áudio, foto.
              </p>
              <a href="/signup"
                 className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white rounded-xl shadow-md hover:-translate-y-0.5 transition-all"
                 style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #4DAE61 100%)` }}>
                Criar conta e conectar meu zap →
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── WhatsApp Chat (dentro do iPhone) ──────────────────────────────

function WhatsAppChat({ mensagens, scrollRef }: { mensagens: MsgRender[]; scrollRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div className="w-full h-full bg-[#0B141A] flex flex-col text-white text-xs"
         style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>

      {/* Status iOS */}
      <div className="flex items-center justify-between px-5 pt-2 pb-1 text-[9px] font-semibold">
        <span>9:41</span>
        <span>●●● 📶 100%</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 bg-[#1F2C33] border-b border-white/5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white/80">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
             style={{ background: 'linear-gradient(135deg, #61ce70 0%, #4DAE61 100%)' }}>
          S
        </div>
        <div className="flex-1 min-w-0 leading-tight">
          <p className="font-semibold text-[12px] truncate">Sora</p>
          <p className="text-[9px] text-white/55">online</p>
        </div>
        <div className="flex items-center gap-2.5 text-white/65 text-[12px]">
          <span>📹</span>
          <span>📞</span>
        </div>
      </div>

      {/* Mensagens */}
      <div ref={scrollRef} className="flex-1 px-2.5 py-3 space-y-2 overflow-y-auto"
           style={{
             backgroundColor: '#0B141A',
             backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cg fill='%23FFFFFF06'%3E%3Cpath d='M10 20l5-5 5 5z'/%3E%3Ccircle cx='40' cy='15' r='4'/%3E%3Cpath d='M60 30l3 3-3 3-3-3z'/%3E%3Ccircle cx='15' cy='50' r='3'/%3E%3Cpath d='M50 60l4-4 4 4-4 4z'/%3E%3C/g%3E%3C/svg%3E")`,
           }}>
        {mensagens.map(m => {
          if (m.lado === 'typing') return <Typing key={m.idx} />;
          if (m.lado === 'user')   return <BolhaUser   key={m.idx} msg={m.msg} hora={m.hora} />;
          return <BolhaSora  key={m.idx} msg={m.msg} hora={m.hora} />;
        })}
      </div>

      {/* Input bar fake */}
      <div className="flex items-center gap-1.5 px-1.5 py-1.5 bg-[#1F2C33]">
        <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 bg-[#2A3942] rounded-full">
          <span className="text-white/40 text-[12px]">😊</span>
          <span className="text-[10px] text-white/40 flex-1">Mensagem</span>
          <span className="text-white/40 text-[12px]">📎</span>
        </div>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px]"
             style={{ background: '#00A884' }}>
          🎤
        </div>
      </div>

      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-[30%] h-0.5 rounded-full bg-white/40" />
    </div>
  );
}

function BolhaUser({ msg, hora }: { msg: MsgUser; hora: string }) {
  return (
    <div className="flex justify-end animate-[slide-up_300ms_ease-out_both]">
      <div className="relative max-w-[80%] px-2.5 py-1.5 rounded-lg rounded-tr-sm text-[11px] leading-snug shadow-sm break-words"
           style={{ background: '#005C4B' }}>
        {msg.tipo === 'text' && msg.texto}

        {msg.tipo === 'audio' && (
          <div className="flex items-center gap-2 py-0.5">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[9px]">▶</div>
            <div className="flex items-end gap-[1.5px] flex-1">
              {[3, 5, 7, 4, 6, 8, 5, 7, 4, 6, 3, 5, 7, 4, 6, 5, 7, 4].map((h, i) => (
                <div key={i} className="w-[2px] rounded-full bg-white/70 animate-pulse"
                     style={{ height: `${h}px`, animationDelay: `${i * 80}ms` }} />
              ))}
            </div>
            <span className="text-[9px] text-white/75">{msg.duracao}</span>
          </div>
        )}

        {msg.tipo === 'image' && (
          <div className="rounded-md overflow-hidden -mx-1 -mt-1">
            <NotaFiscalSvg />
          </div>
        )}

        <div className="text-[8px] text-white/60 text-right mt-0.5 flex items-center justify-end gap-0.5">
          {hora}
          <svg width="12" height="6" viewBox="0 0 12 8" className="ml-0.5">
            <path d="M0 4l2.5 3 4.5-6M4.5 4l2.5 3 4.5-6" stroke="#53BDEB" strokeWidth="1.3" fill="none" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function BolhaSora({ msg, hora }: { msg: MsgSora; hora: string }) {
  return (
    <div className="flex justify-start animate-[slide-up_300ms_ease-out_both]">
      <div className="relative max-w-[88%] px-2.5 py-1.5 rounded-lg rounded-tl-sm text-[11px] leading-relaxed shadow-sm break-words"
           style={{ background: '#202C33' }}>
        {msg.tipo === 'text' && (
          <p className="whitespace-pre-wrap">{formatMarkdown(msg.texto)}</p>
        )}

        {msg.tipo === 'card_saldo' && (
          <div className="my-1">
            <p className="text-[9px] uppercase tracking-wider text-white/55 mb-0.5 font-bold">{msg.periodo} · Saldo</p>
            <p className="text-[18px] font-bold tabular-nums leading-none" style={{ color: BRAND }}>{msg.valor}</p>
            <p className="text-[9px] mt-0.5" style={{ color: BRAND }}>{msg.delta} vs mês anterior</p>
            <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="w-full h-6 mt-1.5">
              <path d={`M0,24 ${msg.sparkline.map((v, i) => `L${(i / (msg.sparkline.length - 1)) * 100},${24 - (v / Math.max(...msg.sparkline)) * 22}`).join(' ')}`}
                    fill="none" stroke={BRAND} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          </div>
        )}

        {msg.tipo === 'card_categoria' && (
          <div className="my-1 min-w-[180px]">
            <p className="text-[9px] uppercase tracking-wider text-white/55 mb-1.5 font-bold">Total: {msg.total}</p>
            <div className="space-y-1.5">
              {msg.categorias.map(c => (
                <div key={c.nome}>
                  <div className="flex items-center justify-between text-[10px] mb-0.5">
                    <span className="inline-flex items-center gap-1"><span className="text-xs">{c.emoji}</span>{c.nome}</span>
                    <span className="font-bold tabular-nums" style={{ color: BRAND }}>{c.valor}</span>
                  </div>
                  {c.pct > 0 && (
                    <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: BRAND }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {msg.tipo === 'card_habito' && (
          <div className="my-1">
            <p className="text-[9px] uppercase tracking-wider text-white/55 mb-1 font-bold">{msg.nome}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-[20px] font-bold tabular-nums leading-none" style={{ color: BRAND }}>🔥 {msg.streak}</span>
              <span className="text-[10px] text-white/60">dias seguidos</span>
            </div>
            <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(msg.streak / msg.meta) * 100}%`, background: BRAND }} />
            </div>
            <p className="text-[9px] text-white/45 mt-0.5">próximo marco: {msg.meta} dias</p>
          </div>
        )}

        {msg.tipo === 'card_remedio' && (
          <div className="my-1">
            <p className="text-[9px] uppercase tracking-wider text-white/55 font-bold">{msg.nome}</p>
            <div className="flex gap-1.5 mt-1">
              {msg.horarios.map(h => (
                <span key={h} className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{
                        background: h.includes('✓') ? 'rgba(97,206,112,0.2)' : 'rgba(255,255,255,0.08)',
                        color: h.includes('✓') ? BRAND : 'rgba(255,255,255,0.7)',
                      }}>
                  {h}
                </span>
              ))}
            </div>
          </div>
        )}

        {msg.tipo === 'card_meta' && (
          <div className="my-1 min-w-[180px]">
            <p className="text-[9px] uppercase tracking-wider text-white/55 mb-1 font-bold">{msg.titulo}</p>
            <div className="flex items-baseline justify-between">
              <span className="text-[16px] font-bold tabular-nums" style={{ color: BRAND }}>{msg.atual}</span>
              <span className="text-[10px] text-white/50">de {msg.objetivo}</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden relative">
              <div className="h-full rounded-full transition-all" style={{ width: `${msg.pct}%`, background: BRAND }} />
            </div>
            <p className="text-[9px] mt-0.5" style={{ color: BRAND }}>{msg.pct}% · ETA {msg.eta}</p>
          </div>
        )}

        {msg.tipo === 'card_dre' && (
          <div className="my-1 min-w-[180px]">
            <p className="text-[9px] uppercase tracking-wider text-white/55 mb-1.5 font-bold">DRE — Maio 2026</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-[8px] text-white/45 uppercase">Receita</p>
                <p className="text-[12px] font-bold tabular-nums">{msg.receita}</p>
              </div>
              <div>
                <p className="text-[8px] text-white/45 uppercase">Lucro</p>
                <p className="text-[12px] font-bold tabular-nums" style={{ color: BRAND }}>{msg.lucro}</p>
              </div>
              <div>
                <p className="text-[8px] text-white/45 uppercase">Margem</p>
                <p className="text-[12px] font-bold tabular-nums">{msg.margem}</p>
              </div>
            </div>
          </div>
        )}

        <div className="text-[8px] text-white/45 text-right mt-0.5">{hora}</div>
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex justify-start animate-[slide-up_200ms_ease-out_both]">
      <div className="px-2.5 py-2 rounded-lg rounded-tl-sm flex items-center gap-1" style={{ background: '#202C33' }}>
        <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce" />
        <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}

function NotaFiscalSvg() {
  return (
    <svg viewBox="0 0 200 280" className="w-full">
      <rect width="200" height="280" fill="#f5f5f0" />
      <rect x="0" y="0" width="200" height="40" fill="#e8e8e2" />
      <text x="100" y="22" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#333">MERCADO EXTRA</text>
      <text x="100" y="33" textAnchor="middle" fontSize="7" fill="#666">CNPJ 12.345.678/0001-90</text>
      <line x1="10" y1="50" x2="190" y2="50" stroke="#999" strokeWidth="0.5" strokeDasharray="2,2" />
      <text x="10" y="65" fontSize="7" fill="#333">15/05/2026 14:32</text>
      <text x="190" y="65" textAnchor="end" fontSize="7" fill="#333">CUPOM 8472</text>
      <line x1="10" y1="75" x2="190" y2="75" stroke="#999" strokeWidth="0.5" strokeDasharray="2,2" />
      {[
        ['ARROZ 5KG', 'R$ 24,90'],
        ['FEIJÃO 1KG', 'R$ 9,50'],
        ['LEITE 1L x3', 'R$ 16,80'],
        ['PÃO FRANCÊS', 'R$ 8,20'],
        ['FRUTAS DIV.', 'R$ 18,40'],
        ['LIMPEZA', 'R$ 9,70'],
      ].map(([item, valor], i) => (
        <g key={i}>
          <text x="10" y={92 + i * 14} fontSize="7" fill="#333">{item}</text>
          <text x="190" y={92 + i * 14} textAnchor="end" fontSize="7" fill="#333">{valor}</text>
        </g>
      ))}
      <line x1="10" y1="190" x2="190" y2="190" stroke="#333" strokeWidth="1" />
      <text x="10" y="205" fontSize="9" fontWeight="bold" fill="#333">TOTAL</text>
      <text x="190" y="205" textAnchor="end" fontSize="10" fontWeight="bold" fill="#333">R$ 87,50</text>
      <line x1="10" y1="215" x2="190" y2="215" stroke="#333" strokeWidth="1" />
      <rect x="60" y="225" width="80" height="40" fill="#000" />
      {Array.from({ length: 20 }).map((_, i) => (
        <line key={i} x1={62 + i * 4} y1="227" x2={62 + i * 4} y2="263" stroke="#fff" strokeWidth={i % 3 === 0 ? "1" : "0.5"} />
      ))}
    </svg>
  );
}

function formatMarkdown(t: string) {
  // Suporte simples a *bold*
  const parts = t.split(/(\*[^*]+\*)/g);
  return parts.map((p, i) =>
    p.startsWith('*') && p.endsWith('*')
      ? <strong key={i} className="font-semibold">{p.slice(1, -1)}</strong>
      : <span key={i}>{p}</span>
  );
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function escurecer(hex: string, amt = 0.18): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - Math.round(255 * amt));
  const g = Math.max(0, ((n >> 8)  & 0xff) - Math.round(255 * amt));
  const b = Math.max(0,  (n        & 0xff) - Math.round(255 * amt));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
