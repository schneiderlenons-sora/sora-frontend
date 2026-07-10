'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Sora /chat — funil interativo multi-etapas (estilo "demo de WhatsApp").
// Fundo branco + verde da marca (#61CE70). Cada etapa avança por clique; a
// simulação de chat revela mensagens com typing + slide-up. Oferta vitalícia
// R$97 no fim → checkout Mercado Pago. Mobile-first, acessível, reduced-motion.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import { trackInitiateCheckout } from '@/lib/analytics';
import CategoryDonut from '@/components/relatorios/CategoryDonut';
import AgendaShowcase from '@/components/landing/AgendaShowcase';
import {
  ArrowRight, ArrowLeft, Check, Send, Bell, Target, Sparkles, TrendingUp,
  ShieldCheck, Star, Clock, Lock, Wallet, PiggyBank, Search, Trophy, Tag, Zap,
} from 'lucide-react';

const BRAND = '#61CE70';
const CTA_BG = 'linear-gradient(135deg, #61CE70 0%, #2E9E54 100%)'; // texto branco legível
const SORA_BG = '#16231b';   // bolha/card da Sora (verde bem escuro)
const USER_BG = 'linear-gradient(135deg, #0d7a45 0%, #075e37 100%)'; // bolha do usuário
const HEAD = '#0f4c2e';      // verde-floresta p/ títulos em fundo branco
const ACCENT = '#159a52';    // verde de acento em texto

const TOTAL = 6;

function useReduce() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setR(mq.matches); on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return r;
}

// ─── Primitivos de chat ──────────────────────────────────────────────────────
function Bubble({ side, children, time, delay = 0, wide }: {
  side: 'user' | 'sora'; children: React.ReactNode; time?: string; delay?: number; wide?: boolean;
}) {
  const user = side === 'user';
  return (
    <div className={`flex ${user ? 'justify-end' : 'justify-start'} animate-[slide-up_420ms_ease-out_both]`}
         style={{ animationDelay: `${delay}ms` }}>
      <div className={`relative ${wide ? 'max-w-[92%]' : 'max-w-[85%]'} px-3.5 py-2.5 text-[14px] leading-snug text-white shadow-md
                       ${user ? 'rounded-2xl rounded-br-md' : 'rounded-2xl rounded-bl-md'}`}
           style={{ background: user ? USER_BG : SORA_BG }}>
        <div className="[&_b]:font-bold [&_strong]:font-bold">{children}</div>
        {time && (
          <div className={`mt-1 flex items-center gap-1 text-[10px] text-white/55 ${user ? 'justify-end' : ''}`}>
            {time}{user && <Check size={11} className="text-sky-300" />}
          </div>
        )}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex justify-start animate-[slide-up_300ms_ease-out_both]">
      <div className="px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-1.5" style={{ background: SORA_BG }}>
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce"
                style={{ animationDelay: `${i * 140}ms` }} />
        ))}
      </div>
    </div>
  );
}

// Card escuro (usado dentro do chat para gráficos/comprovantes)
function SoraCard({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <div className="flex justify-start animate-[slide-up_460ms_ease-out_both]" style={{ animationDelay: `${delay}ms` }}>
      <div className="w-[92%] rounded-2xl rounded-bl-md p-4 text-white shadow-lg ring-1 ring-white/10"
           style={{ background: SORA_BG }}>
        {children}
      </div>
    </div>
  );
}

// "Mensagem" que o usuário clica pra enviar (bolha verde clicável)
function SendPill({ label, onClick, delay = 0 }: { label: string; onClick: () => void; delay?: number }) {
  return (
    <div className="flex justify-center pt-1 animate-[slide-up_360ms_ease-out_both]" style={{ animationDelay: `${delay}ms` }}>
      <button
        onClick={onClick}
        className="send-pulse group w-full max-w-[92%] flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-2xl
                   text-white font-semibold text-[15px] shadow-lg transition-all
                   active:scale-[0.98] hover:brightness-110"
        style={{ background: USER_BG, minHeight: 52, touchAction: 'manipulation' }}
      >
        <Send size={16} className="opacity-90 transition-transform group-hover:translate-x-0.5" />
        {label}
      </button>
    </div>
  );
}

// Botão grande de avançar etapa
function ContinueBtn({ onClick, label = 'Continuar' }: { onClick: () => void; label?: string }) {
  return (
    <div className="pt-4 animate-[slide-up_360ms_ease-out_both]">
      <button
        onClick={onClick}
        className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-white font-bold text-[16px]
                   shadow-[0_12px_30px_-8px_rgba(97,206,112,0.55)] transition-all active:scale-[0.98] hover:brightness-105"
        style={{ background: CTA_BG, minHeight: 56, touchAction: 'manipulation' }}
      >
        {label} <ArrowRight size={18} strokeWidth={2.5} />
      </button>
    </div>
  );
}

function StepNum({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl text-white font-black text-sm flex-shrink-0 shadow-sm"
          style={{ background: CTA_BG }}>{n}</span>
  );
}

function DemoTag() {
  return (
    <div className="flex justify-center">
      <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-white text-[11px] font-bold uppercase tracking-widest shadow"
            style={{ background: CTA_BG }}>
        <Sparkles size={11} /> Demonstração
      </span>
    </div>
  );
}

// ─── Mini data-viz (on-brand, verde) ─────────────────────────────────────────
function BarWeek() {
  const dados = [
    { d: 'sáb', v: 155 }, { d: 'dom', v: 105 }, { d: 'seg', v: 53 }, { d: 'ter', v: 64 },
    { d: 'qua', v: 131 }, { d: 'qui', v: 52 }, { d: 'sex', v: 72 },
  ];
  const max = Math.max(...dados.map((x) => x.v));
  return (
    <div>
      <p className="text-center text-[11px] text-white/55 font-semibold uppercase tracking-wider">Últimos 7 dias</p>
      <p className="text-center text-xl font-black tabular-nums" style={{ color: BRAND }}>R$ 632,00</p>
      <p className="text-center text-[10px] text-white/40 mb-3 tabular-nums">04/07 – 10/07</p>
      <div className="flex items-end justify-between gap-2" style={{ height: 124 }}>
        {dados.map((x, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
            <span className="text-[9px] text-white/70 tabular-nums font-semibold">{x.v}</span>
            <div className="w-[64%] rounded-md animate-[grow-up_650ms_cubic-bezier(0.22,1,0.36,1)_both]"
                 style={{ height: `${Math.round((x.v / max) * 88) + 8}px`, background: 'linear-gradient(180deg, #7de88f 0%, #2E9E54 100%)', animationDelay: `${i * 55}ms`, transformOrigin: 'bottom' }} />
            <span className="text-[9px] text-white/50">{x.d}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-white/70 flex items-center gap-1.5">
        <TrendingUp size={12} style={{ color: BRAND }} /> Seus gastos subiram <b className="text-white">20%</b> essa semana
      </p>
    </div>
  );
}

// Divisão de gastos — soma R$632 (bate com a semana). Cada categoria com uma
// COR distinta (multicolor) e emoji; renderizado pelo CategoryDonut do painel
// (fatia expande/brilha no hover/tap + centro dinâmico).
const DIVISAO = [
  { name: 'Contas Fixas', value: 228, color: '#22c55e', emoji: '📄' },
  { name: 'Jantar fora',  value: 145, color: '#f97316', emoji: '🍽️' },
  { name: 'Transporte',   value: 101, color: '#3b82f6', emoji: '🚗' },
  { name: 'Alimentação',  value: 88,  color: '#d946ef', emoji: '🧃' },
  { name: 'Lazer',        value: 70,  color: '#a855f7', emoji: '🎬' },
];

function LimitsCard() {
  const items = [
    { nome: 'Lazer', pct: 60, txt: 'R$ 252,40 de R$ 500' },
    { nome: 'Delivery', pct: 84, txt: 'R$ 336,42 de R$ 400' },
    { nome: 'Compras', pct: 12, txt: 'R$ 36 de R$ 300' },
    { nome: 'Transporte', pct: 34, txt: 'R$ 204,72 de R$ 600' },
  ];
  return (
    <div>
      <p className="text-center text-[11px] text-white/55 font-semibold uppercase tracking-wider mb-3">Seus limites do mês</p>
      <div className="space-y-3">
        {items.map((it, i) => (
          <div key={it.nome} className="animate-[slide-up_400ms_ease-out_both]" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center justify-between text-[12px] mb-1">
              <span className="text-white/85 font-medium">{it.nome}</span>
              <span className="font-bold tabular-nums" style={{ color: it.pct >= 80 ? '#fcd34d' : BRAND }}>{it.pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full animate-[grow-x_700ms_ease-out_both]"
                   style={{ width: `${it.pct}%`, background: it.pct >= 80 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : 'linear-gradient(90deg,#2E9E54,#61CE70)', animationDelay: `${i * 60}ms`, transformOrigin: 'left' }} />
            </div>
            <p className="text-[10px] text-white/40 mt-0.5 tabular-nums text-right">{it.txt}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function GoalRing() {
  const pct = 9.27, R = 46, C = 2 * Math.PI * R;
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-24 h-24 flex-shrink-0">
        <svg viewBox="0 0 110 110" className="w-24 h-24 -rotate-90">
          <circle cx="55" cy="55" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="10" />
          <circle cx="55" cy="55" r={R} fill="none" stroke={BRAND} strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${(pct / 100) * C} ${C}`} className="animate-[dash-in_800ms_ease-out_both]" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-black text-white tabular-nums">{pct}%</span>
          <span className="text-[9px] text-white/50">da meta</span>
        </div>
      </div>
      <div>
        <p className="text-[11px] text-white/55 font-semibold uppercase tracking-wider flex items-center gap-1.5">
          <Target size={12} style={{ color: BRAND }} /> Nova meta
        </p>
        <p className="text-white font-bold mt-0.5">iPhone 16</p>
        <p className="text-[13px] tabular-nums" style={{ color: BRAND }}>R$ 500 <span className="text-white/40">de</span> R$ 5.399</p>
      </div>
    </div>
  );
}

function Projection() {
  const pts = [50, 900, 1800, 3200, 5200, 7492];
  const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];
  const W = 320, H = 150, pad = 16;
  const max = 7492;
  const xy = pts.map((v, i) => [pad + (i * (W - pad * 2)) / (pts.length - 1), H - pad - (v / max) * (H - pad * 2)]);
  const path = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <div>
      <div className="flex items-end justify-between mb-1 px-1">
        <div><p className="text-[11px] text-zinc-400">Você hoje</p><p className="font-black tabular-nums" style={{ color: ACCENT }}>R$ 50</p></div>
        <div className="text-right"><p className="text-[11px] text-zinc-400">Daqui 6 meses</p><p className="font-black tabular-nums text-lg" style={{ color: ACCENT }}>R$ 7.492</p></div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          <linearGradient id="projFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BRAND} stopOpacity="0.25" />
            <stop offset="100%" stopColor={BRAND} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${path} L${xy[xy.length - 1][0]},${H - pad} L${xy[0][0]},${H - pad} Z`} fill="url(#projFill)" />
        <path d={path} fill="none" stroke={BRAND} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              className="animate-[dash-line_1000ms_ease-out_both]" style={{ strokeDasharray: 1000, strokeDashoffset: 0 }} />
        {xy.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === xy.length - 1 ? 5 : 3.5} fill="#fff" stroke={BRAND} strokeWidth="2.5" />
        ))}
      </svg>
      <div className="flex justify-between px-1 text-[10px] text-zinc-400 tabular-nums">
        {labels.map((l) => <span key={l}>{l}</span>)}
      </div>
    </div>
  );
}

// ─── Cards de "cartão claro" (problema / recursos) ───────────────────────────
function SoftCard({ title, children, delay = 0, icon }: { title: string; children: React.ReactNode; delay?: number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4 border animate-[slide-up_460ms_ease-out_both]"
         style={{ background: 'linear-gradient(160deg, #f0fdf4 0%, #e7f9ee 100%)', borderColor: 'rgba(97,206,112,0.35)', animationDelay: `${delay}ms` }}>
      <h3 className="font-bold text-[15px] flex items-center gap-1.5 leading-tight" style={{ color: HEAD }}>
        {icon}{title}
      </h3>
      <p className="text-[12.5px] text-zinc-600 mt-1.5 leading-relaxed [&_b]:font-bold [&_b]:text-zinc-800">{children}</p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ETAPAS
// ═════════════════════════════════════════════════════════════════════════════
function Etapa0({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <p className="text-[13px] italic font-semibold text-zinc-400">A mesma tecnologia dos gerentes de investimento — no seu bolso.</p>
        <h1 className="text-[26px] leading-[1.15] font-black tracking-tight" style={{ color: HEAD }}>
          Sua vida financeira,<br />organizada por um <span style={{ color: ACCENT }}>áudio</span>.
        </h1>
        <p className="text-[15px] text-zinc-500 leading-relaxed max-w-sm mx-auto">
          Não é app pra baixar, nem planilha, nem Notion. É uma <b className="text-zinc-700">IA de ponta</b> direto no seu WhatsApp.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SoftCard title="Cadê seu dinheiro?" delay={0}>Você trabalha o mês inteiro e no fim <b>não sabe pra onde foi</b> o que ganhou.</SoftCard>
        <SoftCard title="Sem planilha e sem app" delay={60}>Tudo isso é chato e dá preguiça. <b>Aqui você resolve falando</b>, no WhatsApp.</SoftCard>
        <SoftCard title="Perdido nas dívidas?" delay={120}>Não sabe quanto falta, quem deve, quando vence — e <b>sem um plano</b> pra quitar.</SoftCard>
        <SoftCard title="Pagando caro à toa" delay={180}>Compra por impulso e não pesquisa. <b>Gasta mais e deixa de poupar</b>.</SoftCard>
      </div>
      <ContinueBtn onClick={onNext} label="Quero resolver isso" />
    </div>
  );
}

function Etapa1({ onNext }: { onNext: () => void }) {
  const reduce = useReduce();
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  function enviar() { setStage(1); setTimeout(() => setStage(2), reduce ? 0 : 1300); }
  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black tracking-tight" style={{ color: HEAD }}>Como funciona?</h2>
        <p className="text-[14px] text-zinc-500 leading-relaxed max-w-sm mx-auto">
          Um assistente financeiro no seu WhatsApp, <b className="text-zinc-700">24h por dia</b>. Testa aí 👇
        </p>
      </div>
      <DemoTag />
      <div className="flex items-start gap-3">
        <StepNum n={1} />
        <div>
          <p className="text-[14px] font-semibold" style={{ color: HEAD }}>Diz o que comprou e quanto gastou.</p>
          <p className="text-[12px] text-zinc-400 italic mt-0.5">Pode escrever do seu jeito — sem vírgula, sem R$.</p>
        </div>
      </div>
      <div className="space-y-2.5 pt-1">
        {stage === 0 && <SendPill label="Camisa 110" onClick={enviar} />}
        {stage >= 1 && <Bubble side="user" time="17:31">Camisa 110</Bubble>}
        {stage === 1 && <Typing />}
        {stage === 2 && (
          <>
            <SoraCard>
              <p className="text-[11px] text-white/55 font-semibold uppercase tracking-wider mb-1">✅ Gasto registrado</p>
              <p className="font-bold text-[15px]">👕 Camisa <span className="text-white/50 font-normal">(Roupas)</span></p>
              <p className="text-xl font-black tabular-nums" style={{ color: BRAND }}>R$ 110,00</p>
              <p className="text-[10px] text-white/40 mt-1 tabular-nums">10/07/2026 · 17:31</p>
            </SoraCard>
            <Bubble side="sora" delay={140}>
              <span className="flex items-start gap-1.5"><Bell size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#fcd34d' }} />
              Você está quase no seu <b>limite de R$ 200</b>/mês em <b>Roupas</b>.</span>
            </Bubble>
            <ContinueBtn onClick={onNext} />
          </>
        )}
      </div>
    </div>
  );
}

function Etapa2({ onNext }: { onNext: () => void }) {
  const reduce = useReduce();
  const [p, setP] = useState<0 | 1 | 2>(0);
  const [typing, setTyping] = useState(false);
  function ask1() { setTyping(true); setTimeout(() => { setTyping(false); setP(1); }, reduce ? 0 : 1300); }
  function ask2() { setTyping(true); setTimeout(() => { setTyping(false); setP(2); }, reduce ? 0 : 1300); }
  return (
    <div className="space-y-4">
      <DemoTag />
      <div className="flex items-start gap-3">
        <StepNum n={2} />
        <div>
          <p className="text-[14px] font-semibold" style={{ color: HEAD }}>Pergunte <b>tudo</b> sobre suas finanças.</p>
          <p className="text-[12px] text-zinc-400 mt-0.5">Ela entende linguagem natural e te responde na hora.</p>
        </div>
      </div>
      <div className="space-y-2.5 pt-1">
        {p === 0 && <SendPill label="Quanto gastei nos últimos 7 dias?" onClick={ask1} />}
        {p >= 1 && (
          <>
            <Bubble side="user" time="11:19">quanto gastei nos últimos 7 dias?</Bubble>
            <SoraCard delay={80}><BarWeek /></SoraCard>
            <SoraCard delay={200}>
              <p className="text-center text-[11px] text-white/55 font-semibold uppercase tracking-wider mb-1">Divisão de gastos</p>
              <div className="dark">
                <CategoryDonut data={DIVISAO} showList={false} height={188} innerRadius={52} outerRadius={76} />
              </div>
              {/* Legenda compacta (o donut já tem o centro dinâmico + hover) */}
              <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                {DIVISAO.map((c) => (
                  <li key={c.name} className="flex items-center gap-1.5 text-[11.5px]">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                    <span className="text-white/75 flex-1 truncate">{c.name}</span>
                    <span className="text-white font-bold tabular-nums">{Math.round((c.value / 632) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </SoraCard>
          </>
        )}
        {typing && p === 0 && <Typing />}
        {p === 1 && (
          <>
            <p className="text-center text-[13px] text-zinc-500 pt-1">Agora pergunte algo mais esperto 👇</p>
            <SendPill label="O que eu gastei a mais essa semana?" onClick={ask2} />
          </>
        )}
        {p >= 2 && (
          <>
            <Bubble side="user" time="11:22">o que eu gastei a mais essa semana?</Bubble>
            <Bubble side="sora" delay={120} wide>
              Seus gastos subiram <b>R$ 157,00</b> em relação à semana passada. O maior motivo foi a compra de <b>gás de cozinha</b> (segunda e quarta), que não teve na semana anterior. 💡
            </Bubble>
          </>
        )}
        {typing && p === 1 && <Typing />}
        {p === 2 && (
          <>
            <p className="text-center text-[14px] font-semibold px-2" style={{ color: HEAD }}>
              Você nunca mais vai se perguntar <span style={{ color: ACCENT }}>“onde foi parar meu dinheiro?”</span> sem ter a resposta.
            </p>
            <ContinueBtn onClick={onNext} />
          </>
        )}
      </div>
    </div>
  );
}

function Etapa3({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-2xl font-black tracking-tight" style={{ color: HEAD }}>E tem muito mais.</h2>
        <p className="text-[14px] text-zinc-500 mt-1">Tudo por mensagem, do jeito que você já conversa.</p>
      </div>

      {/* 3 — Agenda inteligente (a seção "Agenda Inteligente" do forsora.com) */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <StepNum n={3} />
          <div>
            <p className="text-[14px] font-semibold" style={{ color: HEAD }}>Nunca mais esqueça um <b>compromisso</b>.</p>
            <p className="text-[12px] text-zinc-400 mt-0.5">Lembretes, briefing do dia e agenda — tudo no WhatsApp, do seu jeito. Ela te avisa na hora certa.</p>
          </div>
        </div>
        <AgendaShowcase />
      </div>

      {/* 4 — Limites */}
      <div className="space-y-2.5">
        <div className="flex items-start gap-3"><StepNum n={4} /><p className="text-[14px] font-semibold pt-1" style={{ color: HEAD }}>Defina <b>limites por categoria</b> e controle quanto quer gastar.</p></div>
        <Bubble side="user" time="09:42">como estão meus limites?</Bubble>
        <SoraCard delay={80}><LimitsCard /></SoraCard>
      </div>

      {/* 5 — Metas */}
      <div className="space-y-2.5">
        <div className="flex items-start gap-3"><StepNum n={5} /><p className="text-[14px] font-semibold pt-1" style={{ color: HEAD }}>Crie <b>metas</b> e a Sora te leva até lá.</p></div>
        <Bubble side="user" time="09:43">Cria uma meta pro iPhone 16, preciso de 5.399. Já guardei 500 hoje</Bubble>
        <SoraCard delay={80}><GoalRing /></SoraCard>
      </div>

      {/* 6 — Promoções */}
      <div className="space-y-2.5">
        <div className="flex items-start gap-3"><StepNum n={6} /><p className="text-[14px] font-semibold pt-1" style={{ color: HEAD }}>Receba <b>alertas de promoção</b> do que você quer comprar.</p></div>
        <Bubble side="sora" wide>
          <span className="flex items-start gap-1.5"><Tag size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#fcd34d' }} />
          <span>Você curtiu <b>Viagens</b> — achei uma promoção 👀<br /><b>Pacote Disney 7 dias</b> (ida, volta + hospedagem) por <b style={{ color: BRAND }}>R$ 1.799</b> no Pix ou 10x. 🔥</span></span>
        </Bubble>
      </div>

      <ContinueBtn onClick={onNext} />
    </div>
  );
}

function Etapa4({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-2xl font-black tracking-tight" style={{ color: HEAD }}>Ainda tem mais recursos.</h2>
        <p className="text-[14px] text-zinc-500 mt-1">Tudo pensado pra você <b className="text-zinc-700">não usar uma vez e esquecer</b>.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SoftCard title="Categorias automáticas" delay={0} icon={<Check size={15} className="flex-shrink-0" style={{ color: ACCENT }} />}>
          Não precisa criar nada. A IA <b>identifica e organiza</b> cada gasto sozinha.
        </SoftCard>
        <SoftCard title="Sugestões inteligentes" delay={60} icon={<Sparkles size={15} className="flex-shrink-0" style={{ color: ACCENT }} />}>
          Dicas na medida: <b>“você tá gastando mais em lazer este mês. Fica de olho.”</b>
        </SoftCard>
        <SoftCard title="Análise de compras" delay={120} icon={<Search size={15} className="flex-shrink-0" style={{ color: ACCENT }} />}>
          Diz o que quer comprar e a IA te diz: <b>parcelar, esperar ou pagar à vista</b>.
        </SoftCard>
        <SoftCard title="Desafios com prêmio" delay={180} icon={<Trophy size={15} className="flex-shrink-0" style={{ color: ACCENT }} />}>
          Pare de <b>só</b> economizar: participe de desafios e ganhe recompensas.
        </SoftCard>
      </div>
      <p className="text-center text-[15px] font-bold px-2" style={{ color: HEAD }}>
        A Sora não é só pra registrar gasto. É o caminho pra você <span style={{ color: ACCENT }}>transformar sua vida financeira</span>.
      </p>
      <ContinueBtn onClick={onNext} label="Ver minha oferta" />
    </div>
  );
}

// ─── Depoimentos (famosos do forsora.com) ────────────────────────────────────
const DEPOIMENTOS = [
  { nome: 'Mari Gonzalez', role: 'Influenciadora', img: '/landing/depoimentos/Mari-gonzales.jpg', cor: '#ec4899', quote: 'Amo praticidade! Mando um áudio e a Sora organiza meus gastos e minha agenda.' },
  { nome: 'Otaviano Costa', role: 'Apresentador', img: '/landing/depoimentos/otaviano-costa.jpg', cor: '#2E9E54', quote: 'Minha rotina é uma correria. A Sora virou meu braço direito: mando um áudio e ela cuida do resto.' },
  { nome: 'Ferrugem', role: 'Cantor', img: '/landing/depoimentos/ferrugem.jpg', cor: '#f59e0b', quote: 'Rapaziada, testa aí! Eu só falo e ela anota tudo. Nunca mais esqueci uma conta.' },
  { nome: 'Duda Rubert', role: 'Influenciadora', img: '/landing/depoimentos/duda-rubert.jpg', cor: '#a855f7', quote: 'Gente, muito fácil! Só mando mensagem e tá tudo organizado. Virei fã na primeira semana!' },
  { nome: 'Coringa', role: 'Criador de conteúdo', img: '/landing/depoimentos/coringa.jpg', cor: '#3b82f6', quote: 'Mano, que coisa útil! Eu falo e ela faz. É tipo ter um assistente de verdade.' },
];

function Depoimentos() {
  const [i, setI] = useState(0);
  const [erro, setErro] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const iv = setInterval(() => setI((v) => (v + 1) % DEPOIMENTOS.length), 5000);
    return () => clearInterval(iv);
  }, []);
  const d = DEPOIMENTOS[i];
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full overflow-hidden grid place-items-center text-white font-bold flex-shrink-0"
             style={{ background: d.cor, fontSize: 15 }}>
          {!erro[d.img]
            /* eslint-disable-next-line @next/next/no-img-element */
            ? <img src={d.img} alt={d.nome} className="w-full h-full object-cover" onError={() => setErro((e) => ({ ...e, [d.img]: true }))} draggable={false} />
            : d.nome.split(' ').slice(0, 2).map((p) => p[0]).join('')}
        </div>
        <div>
          <p className="font-bold text-zinc-900 text-[15px]">{d.nome}</p>
          <p className="text-[12px] text-zinc-500">{d.role}</p>
        </div>
        <div className="ml-auto flex gap-0.5">{Array.from({ length: 5 }).map((_, n) => <Star key={n} size={13} fill="#fbbf24" stroke="#fbbf24" />)}</div>
      </div>
      <p className="mt-3 text-[14px] text-zinc-600 leading-relaxed">“{d.quote}”</p>
      <div className="mt-3 flex justify-center gap-1.5">
        {DEPOIMENTOS.map((_, n) => (
          <button key={n} onClick={() => setI(n)} aria-label={`Depoimento ${n + 1}`}
                  className="h-1.5 rounded-full transition-all" style={{ width: n === i ? 18 : 6, background: n === i ? BRAND : '#d4d4d8' }} />
        ))}
      </div>
    </div>
  );
}

function Countdown() {
  const [s, setS] = useState(15 * 60);
  useEffect(() => {
    const iv = setInterval(() => setS((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(iv);
  }, []);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return <span className="tabular-nums">{mm}:{ss}</span>;
}

function Etapa5() {
  function assinar() {
    try { trackInitiateCheckout({ value: 97, currency: 'BRL' }); } catch { /* noop */ }
    window.location.href = '/checkout-vitalicio?tier=completa';
  }
  return (
    <div className="space-y-6">
      {/* Projeção */}
      <div className="text-center space-y-1">
        <h2 className="text-[26px] leading-tight font-black tracking-tight" style={{ color: HEAD }}>
          Imagine você daqui<br /><span style={{ color: ACCENT }}>6 meses.</span>
        </h2>
        <p className="text-[14px] text-zinc-500 max-w-sm mx-auto">Essa é a sua chance de cumprir o que você promete pra si mesma faz tempo.</p>
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <Projection />
        <p className="mt-3 text-[13px] text-center text-zinc-600 leading-relaxed">
          Com <b className="text-zinc-800">dinheiro sobrando</b> pra viajar ou trocar de carro — tudo por causa da decisão que você toma <b style={{ color: ACCENT }}>hoje</b>.
        </p>
      </div>

      {/* Preço / ancoragem */}
      <div className="text-center space-y-2 px-2">
        <p className="text-[14px] text-zinc-500 leading-relaxed">
          Construir uma IA dessas custa caro. Poderíamos cobrar o preço de mercado, <b className="text-zinc-700">R$ 497 por ano</b>.
        </p>
        <p className="text-[15px] font-bold" style={{ color: HEAD }}>
          Mas o que a gente quer é a sua <span style={{ color: ACCENT }}>liberdade financeira</span>. Então liberamos por bem menos — e uma vez só.
        </p>
      </div>

      {/* Contagem regressiva */}
      <div className="flex items-center justify-center gap-2 py-3 rounded-2xl text-white font-bold shadow-md" style={{ background: 'linear-gradient(135deg,#0f4c2e,#16231b)' }}>
        <Clock size={16} style={{ color: BRAND }} /> Oferta por tempo limitado: <Countdown />
      </div>

      <Depoimentos />

      {/* Card da oferta vitalícia */}
      <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-2xl"
           style={{ background: 'linear-gradient(160deg,#0f4c2e 0%, #0a3d24 60%, #16231b 100%)' }}>
        <div aria-hidden className="absolute -top-16 -right-10 w-52 h-52 rounded-full opacity-30 pointer-events-none"
             style={{ background: 'radial-gradient(circle, #61CE70 0%, transparent 60%)' }} />
        <div className="relative">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest"
                  style={{ background: 'rgba(97,206,112,0.2)', color: BRAND }}>
              <Zap size={11} /> Acesso vitalício
            </span>
            <span className="text-[11px] font-bold px-2 py-1 rounded-lg bg-white/10">de R$ 497</span>
          </div>
          <div className="mt-4 flex items-end gap-2">
            <span className="text-white/60 text-lg mb-1">R$</span>
            <span className="text-6xl font-black leading-none tabular-nums">97</span>
            <span className="text-white/60 text-sm mb-1.5">uma vez, pra&nbsp;sempre</span>
          </div>
          <p className="text-white/60 text-[13px] mt-1">Sem mensalidade. Você paga uma vez e usa pra sempre.</p>

          <ul className="mt-4 space-y-2">
            {['Sora no WhatsApp: texto, áudio e foto', 'Gastos, contas, cartões e categorias no automático', 'Metas, limites e lembretes inteligentes', 'Relatórios e análises com IA', 'Alertas de promoção e Sora Grow completo'].map((f) => (
              <li key={f} className="flex items-start gap-2 text-[13.5px] text-white/85">
                <Check size={15} className="mt-0.5 flex-shrink-0" style={{ color: BRAND }} /> {f}
              </li>
            ))}
          </ul>

          <button onClick={assinar}
                  className="mt-5 w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-black font-black text-[17px]
                             shadow-[0_14px_34px_-8px_rgba(97,206,112,0.7)] transition-all active:scale-[0.98] hover:brightness-105"
                  style={{ background: 'linear-gradient(135deg,#61CE70,#b6f54f)', minHeight: 58, touchAction: 'manipulation' }}>
            <Lock size={17} /> Garantir meu acesso vitalício
          </button>
          <div className="mt-3 flex items-center justify-center gap-4 text-white/50 text-[11px]">
            <span className="flex items-center gap-1"><ShieldCheck size={13} /> Pagamento seguro</span>
            <span className="flex items-center gap-1"><Wallet size={13} /> Pix ou 12x</span>
          </div>
        </div>
      </div>

      <p className="text-center text-[12px] text-zinc-400 pb-2 flex items-center justify-center gap-1.5">
        <PiggyBank size={13} /> Feito por programadores e analistas financeiros de ponta.
      </p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export default function ChatExperience() {
  const [step, setStep] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);
  const reduce = useReduce();

  const next = () => setStep((s) => Math.min(s + 1, TOTAL - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }, [step, reduce]);

  const etapas = [
    <Etapa0 key={0} onNext={next} />,
    <Etapa1 key={1} onNext={next} />,
    <Etapa2 key={2} onNext={next} />,
    <Etapa3 key={3} onNext={next} />,
    <Etapa4 key={4} onNext={next} />,
    <Etapa5 key={5} />,
  ];

  return (
    <main className="min-h-dvh bg-white text-zinc-900 antialiased">
      <style>{`
        @keyframes grow-up   { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        @keyframes grow-x    { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes dash-in   { from { opacity: 0; }          to { opacity: 1; } }
        @keyframes dash-line { from { stroke-dashoffset: 1000; } to { stroke-dashoffset: 0; } }
        @keyframes soft-pulse {
          0%, 100% { box-shadow: 0 8px 20px -8px rgba(7,94,55,0.5); }
          50%      { box-shadow: 0 10px 28px -6px rgba(7,94,55,0.7), 0 0 0 5px rgba(97,206,112,0.14); }
        }
        .send-pulse { animation: soft-pulse 2.1s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .send-pulse { animation: none; } }
      `}</style>
      <div ref={topRef} />
      {/* Header + progresso */}
      <header className="sticky top-0 z-20 bg-white/85 backdrop-blur-lg border-b border-zinc-100">
        <div className="max-w-[480px] mx-auto px-5 h-14 flex items-center gap-3">
          {step > 0 ? (
            <button onClick={back} aria-label="Voltar" className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center hover:bg-zinc-100 active:scale-95 transition">
              <ArrowLeft size={18} className="text-zinc-500" />
            </button>
          ) : <span className="w-9" />}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sora-icon.png" alt="Sora" className="w-7 h-7 rounded-lg object-cover" />
          <span className="font-black tracking-tight" style={{ color: HEAD }}>Sora</span>
          <span className="ml-auto text-[11px] font-semibold text-zinc-400 tabular-nums">{step + 1} / {TOTAL}</span>
        </div>
        <div className="h-1 bg-zinc-100">
          <div className="h-full transition-all duration-500" style={{ width: `${((step + 1) / TOTAL) * 100}%`, background: CTA_BG }} />
        </div>
      </header>

      {/* Conteúdo da etapa */}
      <div className="max-w-[480px] mx-auto px-5 pt-6 pb-24">
        <div key={step} className="animate-fade-in">
          {etapas[step]}
        </div>
      </div>
    </main>
  );
}
