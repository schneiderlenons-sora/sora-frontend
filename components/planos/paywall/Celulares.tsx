/* eslint-disable @next/next/no-img-element */
'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Os três celulares do paywall — desenhados em código, não em imagem.
//
// ⚠️ TUDO AQUI É EM `em`, E O `em` NASCE DA LARGURA DO CELULAR (`cqw`). O
// telefone pode ter 120px ou 260px dependendo da tela, e o conteúdo dele
// escala junto, sem um breakpoint sequer. Unidade fixa (px) dentro do mock
// quebraria a proporção na primeira tela diferente.
//
// Decorativo: o bloco inteiro é `aria-hidden` (a descrição vai num texto só
// pra leitor de tela no paywall). Os números são de exemplo, coerentes entre
// si (o gasto do chat aparece no saldo, a categoria bate com a cor do donut).
// ─────────────────────────────────────────────────────────────────────────────

export type TelaCentro = 'chat' | 'bancos' | 'saude' | 'agenda';

const VERDE = '#61CE70';

function Celular({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative aspect-[9/19.4] ${className}`} style={{ containerType: 'inline-size' }}>
      <div
        className="absolute inset-0 rounded-[15cqw] p-[2.4cqw]"
        style={{
          background: 'linear-gradient(160deg, #2a3a37 0%, #0c1312 45%, #1b2826 100%)',
          boxShadow: '0 40px 70px -28px rgba(0,0,0,.85), 0 0 0 1px rgba(255,255,255,.07), inset 0 0 0 1px rgba(255,255,255,.05)',
        }}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[12.6cqw] bg-[#091312]" style={{ fontSize: '4.7cqw' }}>
          {/* barra de status + ilha */}
          <div className="relative z-10 flex items-center justify-between px-[1.6em] pt-[0.9em] text-[0.62em] font-semibold text-white/90 tabular-nums">
            <span>9:41</span>
            <span className="absolute left-1/2 top-[0.7em] h-[1.55em] w-[5.4em] -translate-x-1/2 rounded-full bg-black" />
            <span className="flex items-center gap-[0.3em]">
              <span className="inline-block h-[0.55em] w-[0.9em] rounded-[0.15em] border border-white/80" />
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ── Esquerda: para onde o dinheiro foi ──────────────────────────────────── */
const FATIAS = [
  { nome: 'Alimentação', cor: VERDE, v: 1180.4 },
  { nome: 'Moradia', cor: '#38BDF8', v: 1020 },
  { nome: 'Transporte', cor: '#F5B544', v: 542.3 },
  { nome: 'Lazer', cor: '#B9A6FF', v: 410.2 },
  { nome: 'Saúde', cor: '#F28AB2', v: 330 },
];
const TOTAL = FATIAS.reduce((s, f) => s + f.v, 0);
// Início de cada fatia no anel (em % da volta), calculado uma vez só.
const ARCOS = FATIAS.map((f, i) => ({
  ...f,
  pct: (f.v / TOTAL) * 100,
  inicio: FATIAS.slice(0, i).reduce((s, g) => s + (g.v / TOTAL) * 100, 0),
}));
const brl = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function TelaCategorias() {
  const R = 15.9; // circunferência ≈ 100
  return (
    <div className="px-[1.2em] pt-[1.4em] text-white">
      <p className="text-[0.62em] text-white/55">Outubro</p>
      <p className="text-[0.95em] font-bold tracking-tight">Para onde foi</p>
      <div className="relative mx-auto mt-[0.9em] w-[72%]">
        <svg viewBox="0 0 36 36" className="w-full -rotate-90">
          <circle cx="18" cy="18" r={R} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="4.2" />
          {ARCOS.map((f) => (
            <circle key={f.nome} cx="18" cy="18" r={R} fill="none" stroke={f.cor} strokeWidth="4.2"
              strokeDasharray={`${f.pct - 1.2} ${100 - f.pct + 1.2}`} strokeDashoffset={-f.inicio} strokeLinecap="round" />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[0.5em] text-white/55">gasto no mês</span>
          <span className="text-[0.78em] font-bold tabular-nums">R$ {brl(TOTAL).split(',')[0]}</span>
        </div>
      </div>
      <div className="mt-[1em] space-y-[0.55em]">
        {FATIAS.slice(0, 4).map((f) => (
          <div key={f.nome}>
            <div className="flex items-center justify-between text-[0.56em]">
              <span className="flex items-center gap-[0.45em] text-white/80">
                <span className="h-[0.6em] w-[0.6em] rounded-full" style={{ background: f.cor }} />{f.nome}
              </span>
              <span className="tabular-nums text-white/90">{brl(f.v)}</span>
            </div>
            <div className="mt-[0.3em] h-[0.3em] rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full" style={{ width: `${(f.v / FATIAS[0].v) * 100}%`, background: f.cor }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Direita: o que vem pela frente ──────────────────────────────────────── */
const PROXIMAS = [
  { nome: 'Luz', dia: '28/10', v: '182,40', cor: '#F5B544' },
  { nome: 'Internet', dia: '30/10', v: '99,90', cor: '#38BDF8' },
  { nome: 'Fatura Nubank', dia: '05/11', v: '1.248,77', cor: '#B9A6FF' },
];
const BARRAS = [52, 61, 48, 70, 66, 78, 84];

function TelaPrevisto() {
  return (
    <div className="px-[1.2em] pt-[1.4em] text-white">
      <p className="text-[0.62em] text-white/55">Saldo previsto em 31/10</p>
      <p className="text-[1.25em] font-bold tracking-tight tabular-nums">R$ 8.214,37</p>
      <p className="mt-[0.15em] text-[0.55em] font-semibold" style={{ color: VERDE }}>+ R$ 1.102,50 que no mês passado</p>
      <div className="mt-[1em] flex h-[4.2em] items-end gap-[0.45em]">
        {BARRAS.map((h, i) => (
          <div key={i} className="flex-1 rounded-t-[0.35em]"
            style={{ height: `${h}%`, background: i === BARRAS.length - 1 ? VERDE : 'rgba(97,206,112,.28)' }} />
        ))}
      </div>
      <p className="mt-[1.1em] text-[0.62em] font-semibold text-white/80">Próximas contas</p>
      <div className="mt-[0.5em] space-y-[0.45em]">
        {PROXIMAS.map((c) => (
          <div key={c.nome} className="flex items-center gap-[0.6em] rounded-[0.7em] bg-white/[0.05] px-[0.7em] py-[0.55em]">
            <span className="h-[1.6em] w-[0.28em] rounded-full" style={{ background: c.cor }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.58em] font-semibold">{c.nome}</p>
              <p className="text-[0.5em] text-white/50">vence {c.dia}</p>
            </div>
            <span className="text-[0.58em] font-semibold tabular-nums">R$ {c.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Centro: a conversa (o que só a Sora faz) ────────────────────────────── */
function Bolha({ de, children, atraso, hora }: { de: 'eu' | 'sora'; children: React.ReactNode; atraso: number; hora: string }) {
  const minha = de === 'eu';
  return (
    <div
      className={`flex ${minha ? 'justify-end' : 'justify-start'} motion-safe:animate-[fade-in_420ms_cubic-bezier(.2,.8,.2,1)_both]`}
      style={{ animationDelay: `${atraso}ms` }}
    >
      <div
        className={`max-w-[82%] rounded-[0.95em] px-[0.75em] pb-[0.4em] pt-[0.5em] text-[0.66em] leading-[1.35] ${minha ? 'rounded-br-[0.25em]' : 'rounded-bl-[0.25em]'}`}
        style={{ background: minha ? '#1C5A3B' : '#1B2725', color: '#EAF7F0' }}
      >
        {children}
        <span className="ml-[0.6em] inline-block translate-y-[0.15em] text-[0.78em] text-white/45 tabular-nums">{hora}</span>
      </div>
    </div>
  );
}

function TelaChat() {
  return (
    <div className="flex h-full flex-col text-white">
      <div className="flex items-center gap-[0.6em] border-b border-white/[0.06] px-[1em] pb-[0.7em] pt-[1em]">
        <img src="/brands/sora.png" alt="" className="h-[2.1em] w-[2.1em] rounded-full bg-[#0f3d2a] object-cover" />
        <div>
          <p className="text-[0.7em] font-bold">Sora</p>
          <p className="text-[0.5em]" style={{ color: VERDE }}>online</p>
        </div>
      </div>
      <div className="flex-1 space-y-[0.55em] px-[0.8em] pt-[0.9em]">
        <Bolha de="eu" atraso={500} hora="12:04">gastei 50 no mercado</Bolha>
        <Bolha de="sora" atraso={1300} hora="12:04">
          <span className="font-semibold" style={{ color: VERDE }}>Lancei!</span> R$ 50,00 em Mercado, na conta Nubank.
        </Bolha>
        <Bolha de="eu" atraso={2300} hora="12:31">
          <span className="flex items-center gap-[0.45em]">
            <span className="flex h-[1.6em] w-[1.6em] items-center justify-center rounded-full" style={{ background: VERDE }}>
              <span className="ml-[0.15em] h-0 w-0 border-y-[0.35em] border-l-[0.55em] border-y-transparent border-l-[#0b2a1c]" />
            </span>
            <span className="flex h-[1.3em] items-center gap-[0.13em]">
              {[40, 75, 55, 95, 60, 80, 45, 70, 35, 60].map((h, i) => (
                <span key={i} className="w-[0.16em] rounded-full bg-white/60" style={{ height: `${h}%` }} />
              ))}
            </span>
            <span className="text-white/55 tabular-nums">0:04</span>
          </span>
        </Bolha>
        <Bolha de="sora" atraso={3200} hora="12:31">
          Uber de R$ 23,90 anotado. Você já usou <span className="font-semibold">64%</span> do limite de Transporte.
        </Bolha>
      </div>
      <div className="m-[0.8em] flex items-center gap-[0.5em]">
        <div className="flex-1 rounded-full bg-white/[0.07] px-[0.9em] py-[0.55em] text-[0.56em] text-white/40">Mensagem</div>
        <span className="flex h-[2em] w-[2em] items-center justify-center rounded-full" style={{ background: VERDE }}>
          <span className="h-[0.9em] w-[0.55em] rounded-full border-[0.14em] border-[#0b2a1c]" />
        </span>
      </div>
    </div>
  );
}

/* ── Centro (Agenda): tudo que tem data, num calendário só ───────────────── */
// Dias de outubro/2026 com algo marcado → cor da origem (conta, fatura, compromisso).
const MARCADOS: Record<number, string> = { 5: '#B9A6FF', 12: '#38BDF8', 22: '#F28AB2', 28: '#F5B544', 30: '#38BDF8' };
const HOJE = 21;
const EVENTOS = [
  { quando: '09:00', nome: 'Dentista', det: 'Dra. Paula · lembrete 1h antes', cor: '#F28AB2' },
  { quando: 'hoje', nome: 'Aluguel', det: 'R$ 1.800,00 · conta fixa', cor: VERDE },
  { quando: '28/10', nome: 'Luz', det: 'R$ 182,40 · vence em 7 dias', cor: '#F5B544' },
];

function TelaAgenda() {
  // Outubro/2026 começa numa quinta: 4 casas vazias (domingo = 0).
  const vazios = 4;
  return (
    <div className="px-[1.1em] pt-[1.4em] text-white">
      <p className="text-[0.62em] text-white/55">Agenda</p>
      <p className="text-[0.95em] font-bold tracking-tight">Outubro</p>
      <div className="mt-[0.7em] grid grid-cols-7 gap-y-[0.3em] text-center text-[0.5em] tabular-nums">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <span key={i} className="text-white/35">{d}</span>)}
        {Array.from({ length: vazios }, (_, i) => <span key={`v${i}`} />)}
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
          <span key={d} className="relative mx-auto flex h-[2em] w-[2em] items-center justify-center rounded-full"
            style={d === HOJE ? { background: VERDE, color: '#06200F', fontWeight: 700 } : { color: 'rgba(255,255,255,.78)' }}>
            {d}
            {MARCADOS[d] && (
              <span className="absolute bottom-[0.1em] h-[0.35em] w-[0.35em] rounded-full" style={{ background: MARCADOS[d] }} />
            )}
          </span>
        ))}
      </div>
      <p className="mt-[0.9em] text-[0.62em] font-semibold text-white/80">Hoje e próximos</p>
      <div className="mt-[0.45em] space-y-[0.45em]">
        {EVENTOS.map((e, i) => (
          <div key={e.nome} className="flex items-center gap-[0.6em] rounded-[0.7em] bg-white/[0.05] px-[0.7em] py-[0.5em] motion-safe:animate-[fade-in_420ms_ease-out_both]"
            style={{ animationDelay: `${500 + i * 300}ms` }}>
            <span className="h-[1.7em] w-[0.28em] rounded-full" style={{ background: e.cor }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.6em] font-semibold">{e.nome}</p>
              <p className="truncate text-[0.48em] text-white/50">{e.det}</p>
            </div>
            <span className="text-[0.52em] font-semibold tabular-nums text-white/70">{e.quando}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const BANCOS = [
  { nome: 'Nubank', logo: '/brands/nubank.png', saldo: '4.812,30' },
  { nome: 'Itaú', logo: '/brands/itau.png', saldo: '2.977,15' },
  { nome: 'Inter', logo: '/brands/inter.png', saldo: '424,92' },
];

function TelaBancos() {
  return (
    <div className="px-[1.1em] pt-[1.4em] text-white">
      <p className="text-[0.62em] text-white/55">Open Finance</p>
      <p className="text-[0.95em] font-bold tracking-tight">Seus bancos</p>
      <div className="mt-[0.8em] space-y-[0.5em]">
        {BANCOS.map((b, i) => (
          <div key={b.nome} className="flex items-center gap-[0.65em] rounded-[0.8em] bg-white/[0.05] px-[0.7em] py-[0.6em] motion-safe:animate-[fade-in_420ms_ease-out_both]"
            style={{ animationDelay: `${400 + i * 350}ms` }}>
            <img src={b.logo} alt="" className="h-[1.9em] w-[1.9em] rounded-full bg-white object-cover" />
            <div className="min-w-0 flex-1">
              <p className="text-[0.62em] font-semibold">{b.nome}</p>
              <p className="flex items-center gap-[0.35em] text-[0.5em] text-white/55">
                <span className="h-[0.55em] w-[0.55em] rounded-full" style={{ background: VERDE }} /> sincronizado agora
              </p>
            </div>
            <span className="text-[0.6em] font-semibold tabular-nums">R$ {b.saldo}</span>
          </div>
        ))}
      </div>
      <p className="mt-[1.1em] text-[0.62em] font-semibold text-white/80">Chegou do banco</p>
      <div className="mt-[0.5em] space-y-[0.45em]">
        {[
          { d: 'iFood', c: 'Alimentação', v: '42,90', cor: VERDE },
          { d: 'Posto Shell', c: 'Transporte', v: '180,00', cor: '#F5B544' },
          { d: 'Farmácia', c: 'Saúde', v: '36,75', cor: '#F28AB2' },
        ].map((t, i) => (
          <div key={t.d} className="flex items-center justify-between text-[0.56em] motion-safe:animate-[fade-in_420ms_ease-out_both]"
            style={{ animationDelay: `${1600 + i * 300}ms` }}>
            <span className="flex items-center gap-[0.5em]">
              <span className="h-[0.6em] w-[0.6em] rounded-full" style={{ background: t.cor }} />
              <span>{t.d}<span className="text-white/45"> · {t.c}</span></span>
            </span>
            <span className="tabular-nums text-white/85">−{t.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TelaSaude() {
  const macros = [
    { n: 'Proteína', g: 38, max: 50, cor: VERDE },
    { n: 'Carboidrato', g: 64, max: 90, cor: '#F5B544' },
    { n: 'Gordura', g: 18, max: 30, cor: '#38BDF8' },
  ];
  return (
    <div className="px-[1.1em] pt-[1.4em] text-white">
      <p className="text-[0.62em] text-white/55">Almoço · foto analisada</p>
      <div className="relative mx-auto mt-[0.8em] aspect-square w-[62%] rounded-full bg-[#e9efe9] p-[8%] shadow-[inset_0_0_0_0.5em_#d6ded7]">
        <div className="relative h-full w-full rounded-full bg-[#f6f8f4]">
          <span className="absolute left-[14%] top-[18%] h-[38%] w-[40%] rounded-[45%] bg-[#e8c46b]" />
          <span className="absolute right-[12%] top-[22%] h-[30%] w-[34%] rounded-[50%] bg-[#7a4a2e]" />
          <span className="absolute bottom-[14%] left-[26%] h-[30%] w-[48%] rounded-[50%] bg-[#5fae4e]" />
          <span className="absolute bottom-[26%] right-[18%] h-[14%] w-[16%] rounded-full bg-[#e2573f]" />
        </div>
      </div>
      <p className="mt-[0.8em] text-center text-[1.15em] font-bold tabular-nums">612 <span className="text-[0.55em] font-semibold text-white/55">kcal</span></p>
      <div className="mt-[0.7em] space-y-[0.55em]">
        {macros.map((m, i) => (
          <div key={m.n}>
            <div className="flex justify-between text-[0.56em]">
              <span className="text-white/80">{m.n}</span>
              <span className="tabular-nums">{m.g} g</span>
            </div>
            <div className="mt-[0.3em] h-[0.32em] overflow-hidden rounded-full bg-white/[0.07]">
              <div className="h-full origin-left rounded-full motion-safe:animate-[cresce_900ms_cubic-bezier(.2,.8,.2,1)_both]"
                style={{ width: `${(m.g / m.max) * 100}%`, background: m.cor, animationDelay: `${600 + i * 200}ms` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * O trio. O do meio fica na frente, e é ele que conta a história da aba que a
 * pessoa tocou (`centro`).
 */
export default function Celulares({ centro = 'chat' }: { centro?: TelaCentro }) {
  return (
    <div aria-hidden className="relative mx-auto h-[min(118vw,560px)] w-full max-w-[540px] select-none">
      {/* esquerda */}
      <div className="absolute -left-[3%] top-[11%] w-[40%] -rotate-[8deg]">
        <div className="motion-safe:animate-[slide-up_700ms_cubic-bezier(.2,.8,.2,1)_both]" style={{ animationDelay: '120ms' }}>
          <Celular><TelaCategorias /></Celular>
        </div>
      </div>
      {/* direita */}
      <div className="absolute -right-[3%] top-[11%] w-[40%] rotate-[8deg]">
        <div className="motion-safe:animate-[slide-up_700ms_cubic-bezier(.2,.8,.2,1)_both]" style={{ animationDelay: '220ms' }}>
          <Celular><TelaPrevisto /></Celular>
        </div>
      </div>
      {/* centro, na frente */}
      <div className="absolute left-1/2 top-0 z-10 w-[52%] -translate-x-1/2">
        <div className="motion-safe:animate-[slide-up_700ms_cubic-bezier(.2,.8,.2,1)_both]">
          <Celular>
            {centro === 'bancos' ? <TelaBancos /> : centro === 'saude' ? <TelaSaude /> : centro === 'agenda' ? <TelaAgenda /> : <TelaChat />}
          </Celular>
        </div>
      </div>
    </div>
  );
}
