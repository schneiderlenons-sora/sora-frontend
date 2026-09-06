'use client';

import {
  Home, ShoppingCart, Car, Sparkles, Repeat, LineChart, Utensils,
  ClipboardList, ArrowDownToLine, ArrowUpFromLine, Check, Lock, TrendingUp,
} from 'lucide-react';

/**
 * Os 9 slides da demonstração — TODOS desenhados, nenhum é captura de tela.
 *
 * ⚠️ A ARTE DEIXOU DE SER SCREENSHOT, e a razão é medida: as telas de
 * `public/screenshots/` são capturas de DESKTOP (16:9). Em 390px de largura elas
 * só cabiam dentro de uma moldura, e uma moldura ocupando 60% da tela deixa o
 * conteúdo do app do tamanho de uma unha — a pessoa vê que "tem um app ali", não
 * O QUE o app faz. Desenhados em JSX, os mesmos elementos ficam em tamanho de
 * leitura, nítidos em qualquer densidade, pesam zero byte e ainda animam.
 *
 * ⚠️ São ILUSTRAÇÕES da funcionalidade, não promessas de layout. Cada uma mostra
 * uma capacidade que existe: categorização automática, ciclo do cartão, limites,
 * projeção, proventos, Open Finance. Números são exemplos redondos, escolhidos
 * pra ler rápido — nunca pra sugerir resultado.
 */

export type Slide = {
  id: string;
  /** A palavra que ganha o traço da marca. Tem de existir dentro de `titulo`. */
  destaque: string;
  titulo: string;
  texto: string;
};

export const SLIDES: Slide[] = [
  {
    id: 'whatsapp',
    titulo: 'Mande no WhatsApp, a Sora lança',
    destaque: 'no WhatsApp',
    texto: '"Gastei 50 no mercado" e pronto: valor, categoria e conta certos, sem abrir o app.',
  },
  {
    id: 'categorias',
    titulo: 'Suas compras viram categorias sozinhas',
    destaque: 'sozinhas',
    texto: 'A Sora reconhece o estabelecimento e categoriza automaticamente. O que você corrigir uma vez vira regra.',
  },
  {
    id: 'calendario',
    titulo: 'Veja seu dinheiro como um calendário',
    destaque: 'calendário',
    texto: 'Cada dia do mês pintado pelo que entrou e pelo que saiu. O que já aconteceu e o que ainda vem, na mesma tela.',
  },
  {
    id: 'limites',
    titulo: 'Saiba que vai estourar antes de estourar',
    destaque: 'antes de estourar',
    texto: 'Limite por categoria com barra de consumo, e aviso no WhatsApp quando você chega perto.',
  },
  {
    id: 'assinaturas',
    titulo: 'Tudo que se repete, num lugar só',
    destaque: 'lugar só',
    texto: 'A Sora encontra o que cobra todo mês e mostra o valor e a data da próxima cobrança de cada uma.',
  },
  {
    id: 'projecao',
    titulo: 'Saiba hoje quanto vai sobrar no fim do mês',
    destaque: 'sobrar',
    texto: 'Aqui você vê exatamente isso antes de acontecer, usando lançamentos manuais ou sincronizados.',
  },
  {
    id: 'proventos',
    titulo: 'Sua carteira e o que ela paga de volta',
    destaque: 'paga de volta',
    texto: 'Dividendo, juros sobre capital próprio e aluguel de fundo imobiliário entram como renda passiva.',
  },
  {
    id: 'pedidos',
    titulo: 'O que você pedir, a gente constrói',
    destaque: 'constrói',
    texto: 'Suporte direto no app e pelo WhatsApp. Estas funcionalidades saíram de pedido de quem usa.',
  },
  {
    id: 'contas',
    titulo: 'Conecte seu banco e isso tudo se preenche sozinho',
    destaque: 'sozinho',
    texto: 'Por Open Finance, regulado pelo Banco Central. A Sora não guarda a senha do seu banco, e você desconecta quando quiser.',
  },
];

/* ══════════════════════════════════════════════════════════════════════════
   PRIMITIVAS
   ══════════════════════════════════════════════════════════════════════════ */

const VERDE = '#61ce70';

/**
 * A superfície do app dentro do slide.
 *
 * ⚠️ Sem moldura de celular. O slide JÁ está num celular — desenhar outro em
 * volta rouba largura da arte pra ilustrar algo que a pessoa tem na mão.
 */
function Tela({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`w-full max-w-[400px] mx-auto px-5 ${className}`}>{children}</div>
  );
}

/** Entrada escalonada — 40ms por item, o intervalo que lê como sequência. */
function Entra({ i = 0, children, className = '' }: { i?: number; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`motion-safe:animate-[slide-up_560ms_cubic-bezier(0.22,1,0.36,1)_both] ${className}`}
      style={{ animationDelay: `${140 + i * 45}ms` }}
    >
      {children}
    </div>
  );
}

const CARD = 'rounded-2xl border border-white/[0.07] bg-white/[0.035] backdrop-blur-sm';

/* ══════════════════════════════════════════════════════════════════════════
   1 · WHATSAPP
   ══════════════════════════════════════════════════════════════════════════ */

function Bolha({ minha, children, atraso }: { minha?: boolean; children: React.ReactNode; atraso: number }) {
  return (
    <div
      className={`flex ${minha ? 'justify-end' : 'justify-start'} motion-safe:animate-[slide-up_500ms_ease-out_both]`}
      style={{ animationDelay: `${atraso}ms` }}
    >
      <div
        className={`max-w-[82%] px-3.5 py-2.5 text-[13.5px] leading-relaxed shadow-lg ${
          minha ? 'rounded-2xl rounded-br-md text-[#0A2A14]' : 'rounded-2xl rounded-bl-md text-white/95'
        }`}
        style={{ background: minha ? VERDE : 'rgba(255,255,255,0.09)' }}
      >
        {children}
      </div>
    </div>
  );
}

export function MockConversa() {
  return (
    <Tela className="flex h-full items-end pb-2">
      <div className="w-full space-y-2.5">
        <Bolha minha atraso={120}>Gastei 50 no mercado</Bolha>
        <Bolha atraso={520}>
          <span className="font-semibold">Anotado! 💚</span>
          <br />🛒 R$ 50,00 · Supermercado
          <br /><span className="text-white/60">Nubank · hoje</span>
        </Bolha>
        <Bolha minha atraso={1000}>quanto gastei com mercado esse mês?</Bolha>
        <Bolha atraso={1400}>
          Você gastou <span className="font-semibold">R$ 412,80</span> em Supermercado em setembro —
          12% a menos que em agosto.
        </Bolha>
      </div>
    </Tela>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   2 · CATEGORIAS — rosca + lista
   ══════════════════════════════════════════════════════════════════════════ */

const CATEGORIAS = [
  { nome: 'Moradia',    valor: 'R$ 1.450,00', pct: 28, cor: '#3b82f6', Icone: Home },
  { nome: 'Mercado',    valor: 'R$ 892,40',   pct: 18, cor: '#22c55e', Icone: ShoppingCart },
  { nome: 'Transporte', valor: 'R$ 610,00',   pct: 14, cor: '#06b6d4', Icone: Car },
  { nome: 'Carro',      valor: 'R$ 528,00',   pct: 12, cor: '#f59e0b', Icone: Car },
  { nome: 'Assinaturas',valor: 'R$ 224,00',   pct: 10, cor: '#8b5cf6', Icone: Sparkles },
  { nome: 'Restaurante',valor: 'R$ 124,00',   pct: 8,  cor: '#ec4899', Icone: Utensils },
];

export function MockCategorias() {
  const R = 74;
  const C = 2 * Math.PI * R;
  const VAO = 2.2;                       // graus de respiro entre fatias
  let acumulado = 0;

  return (
    <Tela className="pt-3">
      {/* ── Rosca ────────────────────────────────────────────────────────────
          ⚠️ SVG, não recharts. A regra do CLAUDE.md proíbe recharts fora de
          `next/dynamic`, e uma rosca estática é `stroke-dasharray` — 290 KB de
          lib pra desenhar seis arcos seria custo sem contrapartida. */}
      <Entra i={0}>
        <div className="relative mx-auto" style={{ width: 210, height: 210 }}>
          <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
            <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="19" />
            {CATEGORIAS.map((c) => {
              const traco = (c.pct / 100) * C - VAO;
              const el = (
                <circle
                  key={c.nome}
                  cx="100" cy="100" r={R} fill="none"
                  stroke={c.cor} strokeWidth="19" strokeLinecap="round"
                  strokeDasharray={`${traco} ${C - traco}`}
                  strokeDashoffset={-(acumulado / 100) * C}
                />
              );
              acumulado += c.pct;
              return el;
            })}
          </svg>

          {/* Miolo: o número que a rosca soma. Sem ele a rosca é decoração. */}
          {/* ⚠️ O TEXTO TEM DE CABER NO BURACO, e isso é medida, não estilo:
              com traço de 26 o vão interno dava 128px e "R$ 3.828,40" a 26px
              ocupa ~150 — o número saía por cima das fatias, com a rosca
              atravessando a palavra. Traço de 19 abre o vão pra ~140 e o
              corpo de 21 cabe com folga. */}
          <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
            <p className="text-[21px] font-bold tabular-nums tracking-tight leading-none">R$ 3.828,40</p>
            <p className="text-[10px] text-white/45 mt-1 leading-tight">gasto até hoje<br />6 categorias</p>
          </div>
        </div>
      </Entra>

      {/* ⚠️ Ícone + NOME na lista, nunca só a cor da fatia. Seis tons de rosca
          não são legenda: quem não distingue tom fica sem saber o que é o quê. */}
      <div className="mt-4 space-y-1.5">
        {CATEGORIAS.slice(0, 4).map((c, i) => (
          <Entra key={c.nome} i={i + 1}>
            <div className={`flex items-center gap-3 px-3 py-2.5 ${CARD}`}>
              <span
                className="w-8 h-8 rounded-xl grid place-items-center flex-shrink-0"
                style={{ background: `${c.cor}22` }}
              >
                <c.Icone size={15} style={{ color: c.cor }} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold">{c.nome}</span>
                <span className="block text-[11px] text-white/40">{c.pct}% do mês</span>
              </span>
              <span className="text-[13.5px] font-bold tabular-nums">{c.valor}</span>
            </div>
          </Entra>
        ))}
      </div>
    </Tela>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   3 · CALENDÁRIO — o mês pintado
   ══════════════════════════════════════════════════════════════════════════ */

// dia → intensidade (0 = nada) e sinal (+ entrou / − saiu).
const DIAS_MES: Record<number, { i: number; sinal: '+' | '-' }> = {
  1: { i: 0.9, sinal: '+' }, 2: { i: 0.5, sinal: '-' }, 3: { i: 0.7, sinal: '-' },
  5: { i: 1, sinal: '+' }, 6: { i: 0.35, sinal: '-' }, 9: { i: 0.6, sinal: '-' },
  11: { i: 0.45, sinal: '-' }, 12: { i: 0.8, sinal: '-' }, 15: { i: 1, sinal: '+' },
  16: { i: 0.3, sinal: '-' }, 18: { i: 0.65, sinal: '-' }, 19: { i: 0.4, sinal: '-' },
  22: { i: 0.55, sinal: '-' }, 23: { i: 0.85, sinal: '-' }, 25: { i: 0.5, sinal: '+' },
  26: { i: 0.7, sinal: '-' }, 29: { i: 0.35, sinal: '-' },
};

export function MockCalendario() {
  const semanas = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
  return (
    <Tela className="pt-3">
      <Entra i={0}>
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 text-center">
          Setembro <span className="text-white/25">2026</span>
        </p>
      </Entra>

      <Entra i={1}>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[
            { r: 'Entrada', v: 'R$ 4.200', cor: VERDE },
            { r: 'Saída', v: 'R$ 3.221', cor: '#ef4444' },
            { r: 'Resultado', v: 'R$ 979', cor: '#8b5cf6' },
          ].map((x) => (
            <div key={x.r} className={`px-2.5 py-2 ${CARD}`}>
              <p className="text-[9.5px] font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: x.cor }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: x.cor }} aria-hidden />
                {x.r}
              </p>
              <p className="text-[13px] font-bold tabular-nums mt-1">{x.v}</p>
            </div>
          ))}
        </div>
      </Entra>

      <Entra i={2}>
        <div className="mt-4">
          <div className="grid grid-cols-7 gap-1.5 mb-1.5">
            {semanas.map((d, i) => (
              <span key={i} className="text-[10px] text-white/30 text-center font-medium">{d}</span>
            ))}
          </div>
          {/* ⚠️ Grade FIXA de 5 linhas: a altura não muda entre slides, então
              nada salta quando o carrossel troca de página. */}
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 35 }).map((_, k) => {
              // ⚠️ 1º/09/2026 É TERÇA — conferido, não estimado. Com a grade
              // começando na SEGUNDA, o dia 1 mora na segunda coluna (k=1). Eu
              // tinha posto k-1 e o mês inteiro andava uma casa: o calendário
              // ilustrava uma semana que não existe.
              const dia = k;
              const dentro = dia >= 1 && dia <= 30;
              const d = dentro ? DIAS_MES[dia] : undefined;
              const cor = d?.sinal === '+' ? VERDE : '#a855f7';
              return (
                <div
                  key={k}
                  className="aspect-square rounded-lg grid place-items-center text-[11.5px] font-semibold transition-colors"
                  style={{
                    background: d ? `${cor}${Math.round(d.i * 60 + 18).toString(16).padStart(2, '0')}` : 'rgba(255,255,255,0.035)',
                    color: dentro ? (d ? '#fff' : 'rgba(255,255,255,0.35)') : 'transparent',
                    boxShadow: dia === 5 ? `inset 0 0 0 1.5px ${VERDE}` : undefined,
                  }}
                >
                  {dentro ? dia : ''}
                </div>
              );
            })}
          </div>
        </div>
      </Entra>
    </Tela>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   4 · LIMITES
   ══════════════════════════════════════════════════════════════════════════ */

const LIMITES = [
  { nome: 'Mercado Livre', tag: 'Subcategoria', limite: 'R$ 400,00', gasto: 'R$ 131,91', pct: 33, cor: VERDE, rot: -2.5, op: 1 },
  { nome: 'iFood', tag: 'Subcategoria', limite: 'R$ 300,00', gasto: 'R$ 246,10', pct: 82, cor: '#f59e0b', rot: 1.8, op: 0.82 },
  { nome: 'Restaurante', tag: 'Categoria', limite: 'R$ 250,00', gasto: 'R$ 243,00', pct: 97, cor: '#ef4444', rot: -1.2, op: 0.6 },
];

export function MockLimites() {
  return (
    <Tela className="pt-4 space-y-3">
      {LIMITES.map((l, i) => (
        <Entra key={l.nome} i={i}>
          {/* ⚠️ O ÂNGULO É DECORAÇÃO E TEM DE PARAR ANTES DE ATRAPALHAR: 2,5° dá
              a pilha de cartas sem inclinar o texto a ponto de cansar. E a
              opacidade cai conforme desce — é o que dá profundidade sem sombra
              falsa. */}
          <div
            className={`p-3.5 ${CARD}`}
            style={{
              transform: `rotate(${l.rot}deg)`,
              opacity: l.op,
              borderColor: `${l.cor}33`,
              boxShadow: `0 8px 30px -12px ${l.cor}55`,
            }}
          >
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full grid place-items-center flex-shrink-0"
                    style={{ background: `${l.cor}22` }}>
                <TrendingUp size={14} style={{ color: l.cor }} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-bold leading-tight">{l.nome}</span>
                <span className="block text-[9.5px] uppercase tracking-wider text-white/35">{l.tag}</span>
              </span>
              <span className="text-[13px] font-bold tabular-nums" style={{ color: l.cor }}>{l.pct}%</span>
            </div>

            <p className="text-[19px] font-bold tabular-nums mt-2.5 leading-none">{l.limite}</p>
            <p className="text-[10.5px] text-white/35 mt-0.5">limite mensal</p>

            <div className="mt-2.5 h-2 rounded-full overflow-hidden bg-white/[0.07]">
              <div
                className="h-full rounded-full motion-safe:animate-[cresce_900ms_cubic-bezier(0.22,1,0.36,1)_both]"
                style={{ width: `${l.pct}%`, background: l.cor, transformOrigin: 'left', animationDelay: `${400 + i * 120}ms` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[11px] text-white/50 tabular-nums">{l.gasto} gasto</span>
              {/* ⚠️ "faltam X" e não só a %: a pergunta que a pessoa faz olhando
                  o limite é "quanto ainda posso gastar", não "que fração usei". */}
              <span className="text-[11px] tabular-nums" style={{ color: l.cor }}>
                faltam {l.pct >= 100 ? 'R$ 0,00' : `R$ ${(
                  (parseFloat(l.limite.replace(/[^\d,]/g, '').replace(',', '.'))
                    - parseFloat(l.gasto.replace(/[^\d,]/g, '').replace(',', '.')))
                ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              </span>
            </div>
          </div>
        </Entra>
      ))}
    </Tela>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   5 · ASSINATURAS
   ══════════════════════════════════════════════════════════════════════════ */

const ASSINATURAS = [
  { nome: 'Spotify', valor: 'R$ 21,90', quando: 'cancelada', logo: '/brands/spotify.png', off: true },
  { nome: 'Smart Fit', valor: 'R$ 99,90', quando: 'cancelada', logo: null, off: true },
  { nome: 'Amazon Prime', valor: 'R$ 19,90', quando: 'todo dia 18', logo: '/brands/amazon.png' },
  { nome: 'Netflix', valor: 'R$ 55,90', quando: 'cancelada', logo: '/brands/netflix.png', off: true },
  { nome: 'Internet', valor: 'R$ 129,00', quando: 'todo dia 28', logo: null },
  { nome: 'YouTube Premium', valor: 'R$ 24,90', quando: 'todo dia 22', logo: '/brands/youtube-premium.png' },
];

export function MockAssinaturas() {
  return (
    <Tela className="pt-3">
      <Entra i={0}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">
          Todo mês, sem você lembrar
        </p>
        <p className="text-[30px] font-bold tabular-nums tracking-tight leading-none mt-1">R$ 173,80</p>
        <p className="text-[12.5px] text-white/45 mt-1">em 3 assinaturas que se repetem</p>
        <span
          className="inline-block mt-2.5 px-3 py-1.5 rounded-full text-[12px] font-bold"
          style={{ background: `${VERDE}1f`, color: VERDE }}
        >
          R$ 177,70 a menos por mês
        </span>
      </Entra>

      <div className="grid grid-cols-3 gap-2 mt-4">
        {ASSINATURAS.map((a, i) => (
          <Entra key={a.nome} i={i + 1}>
            <div
              className={`p-2.5 h-full ${CARD}`}
              style={a.off ? { borderColor: `${VERDE}2e` } : undefined}
            >
              <span className="w-8 h-8 rounded-lg grid place-items-center overflow-hidden bg-white/[0.06]">
                {a.logo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={a.logo} alt="" className="w-full h-full object-cover" />
                  : <Repeat size={14} className="text-white/50" aria-hidden />}
              </span>
              <p className={`text-[11px] font-semibold mt-1.5 truncate ${a.off ? 'text-white/35' : ''}`}>{a.nome}</p>
              <p className={`text-[13px] font-bold tabular-nums leading-tight ${a.off ? 'text-white/35' : ''}`}>{a.valor}</p>
              {/* ⚠️ "cancelada" é TEXTO, não só o cartão apagado: o estado é
                  informação, e opacidade sozinha não chega a quem não enxerga
                  contraste sutil. */}
              <p className="text-[9.5px] text-white/30 mt-0.5 truncate">{a.quando}</p>
            </div>
          </Entra>
        ))}
      </div>
    </Tela>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   6 · PROJEÇÃO
   ══════════════════════════════════════════════════════════════════════════ */

export function MockProjecao() {
  const dias = [30, 31, 1, 2, 3, 4, 5];
  const rotulos = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  return (
    <Tela className="pt-3">
      <Entra i={0}>
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brands/itau.png" alt="" className="w-6 h-6 rounded-md object-cover" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brands/nubank.png" alt="" className="w-6 h-6 rounded-md object-cover -ml-3" />
          <span className="text-[15px] font-semibold ml-1">Todos os bancos</span>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mt-1">Setembro 2026</p>
      </Entra>

      <Entra i={1}>
        <div className="mt-3">
          <div className="grid grid-cols-7 gap-1">
            {rotulos.map((r) => (
              <span key={r} className="text-[10px] text-white/30 text-center">{r}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 mt-1">
            {dias.map((d, i) => (
              <span
                key={i}
                className="aspect-square rounded-full grid place-items-center text-[13px] font-semibold"
                style={
                  d === 3
                    ? { background: VERDE, color: '#08210f' }
                    : { color: i < 2 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.7)' }
                }
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      </Entra>

      <Entra i={2}>
        <div className={`grid grid-cols-3 mt-3.5 ${CARD}`}>
          {[['Entrada', 'R$ 0,00'], ['Saída', 'R$ 0,00'], ['Saldo banco', 'R$ 0,00']].map(([r, v]) => (
            <div key={r} className="px-2.5 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/35">{r}</p>
              <p className="text-[12.5px] font-bold tabular-nums mt-1">{v}</p>
            </div>
          ))}
        </div>
      </Entra>

      <Entra i={3}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/35 mt-3.5">Projeção até 30 set.</p>
        <div className={`grid grid-cols-3 mt-1.5 ${CARD}`} style={{ borderColor: `${VERDE}2b` }}>
          {[
            ['Entrada', '+R$ 4.200,00', VERDE],
            ['Saída', '−R$ 2.836,50', '#ef4444'],
            ['Saldo previsto', 'R$ 1.363,50', VERDE],
          ].map(([r, v, c]) => (
            <div key={r} className="px-2.5 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/35">{r}</p>
              <p className="text-[12.5px] font-bold tabular-nums mt-1" style={{ color: c }}>{v}</p>
            </div>
          ))}
        </div>
      </Entra>

      <Entra i={4}>
        <div className={`mt-3 divide-y divide-white/[0.06] ${CARD}`}>
          {[
            ['08:00', 'Café da manhã', 'R$ 18,90', Utensils],
            ['12:30', 'Uber', 'R$ 24,00', Car],
          ].map(([h, t, v, I]: any) => (
            <div key={t} className="flex items-center gap-2.5 px-3 py-2.5">
              <span className="text-[10.5px] text-white/30 tabular-nums w-9">{h}</span>
              <I size={14} className="text-white/45 flex-shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 text-[12.5px] truncate">{t}</span>
              <span className="text-[12.5px] font-semibold tabular-nums">{v}</span>
            </div>
          ))}
        </div>
      </Entra>
    </Tela>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   7 · PROVENTOS
   ══════════════════════════════════════════════════════════════════════════ */

export function MockProventos() {
  const meses = [
    { m: 'JUN', v: 'R$ 47,38', d: '+109,1%', sobe: true, y: 58 },
    { m: 'JUL', v: 'R$ 15,66', d: '−66,9%', sobe: false, y: 92 },
    { m: 'AGO', v: 'R$ 78,28', d: '+399,9%', sobe: true, y: 26 },
  ];
  return (
    <Tela className="pt-4">
      <Entra i={0}>
        <p className="text-[17px] font-bold text-center leading-tight">O que a carteira te paga de volta</p>
        <p className="text-[12px] text-white/45 text-center mt-1.5 leading-relaxed">
          R$ 247,20 em dividendo, juros sobre capital próprio e aluguel de fundo imobiliário nos últimos seis meses
        </p>
      </Entra>

      <Entra i={1}>
        <div className="flex items-center justify-between mt-4">
          <span className="text-[13px] font-bold">Renda passiva</span>
          {/* ⚠️ Legenda com traço + palavra. Duas linhas de cores parecidas num
              gráfico pequeno não se distinguem sem rótulo. */}
          <span className="flex items-center gap-3 text-[10.5px] text-white/45">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-[2px] rounded-full" style={{ background: '#8b5cf6' }} aria-hidden />Recebido
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-[2px] rounded-full" style={{ background: VERDE }} aria-hidden />Em aberto
            </span>
          </span>
        </div>
      </Entra>

      <Entra i={2}>
        <div className="relative mt-3" style={{ height: 150 }}>
          <svg viewBox="0 0 300 120" className="w-full h-full" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id="tour-prov" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M20,58 C70,58 70,92 150,92 C230,92 230,26 280,26 L280,120 L20,120 Z" fill="url(#tour-prov)" />
            <path
              d="M20,58 C70,58 70,92 150,92 C230,92 230,26 280,26"
              fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round"
            />
          </svg>
          {meses.map((x, i) => (
            <span
              key={x.m}
              className="absolute w-3 h-3 rounded-full border-2 border-[#0b0f0c]"
              style={{
                background: i === 2 ? VERDE : '#8b5cf6',
                left: `${[6.7, 50, 93.3][i]}%`,
                top: `${(x.y / 120) * 100}%`,
                transform: 'translate(-50%,-50%)',
              }}
              aria-hidden
            />
          ))}
        </div>
      </Entra>

      <div className="grid grid-cols-3 gap-2 -mt-1">
        {meses.map((x, i) => (
          <Entra key={x.m} i={i + 3}>
            <div
              className={`px-2 py-2.5 text-center ${CARD}`}
              style={i === 2 ? { borderColor: `${VERDE}55`, background: `${VERDE}12` } : undefined}
            >
              <p className="text-[9.5px] font-bold uppercase tracking-wider text-white/35">{x.m}</p>
              {/* ⚠️ Seta + sinal, não só verde/vermelho: alta e queda não podem
                  depender de distinguir as duas cores mais confundidas que existem. */}
              <p className="text-[10.5px] font-bold mt-1" style={{ color: x.sobe ? VERDE : '#ef4444' }}>
                {x.sobe ? '▲' : '▼'} {x.d}
              </p>
              <p className="text-[13px] font-bold tabular-nums mt-0.5" style={i === 2 ? { color: VERDE } : undefined}>
                {x.v}
              </p>
            </div>
          </Entra>
        ))}
      </div>
    </Tela>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   8 · PEDIDOS
   ══════════════════════════════════════════════════════════════════════════ */

const PEDIDOS = [
  'Escolher o tipo antes de lançar',
  'Limite por subcategoria',
  'Fatura pelo ciclo do cartão',
];

export function MockPedidos() {
  return (
    <Tela className="pt-4">
      <Entra i={0}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">Pedido de quem usa</p>
        <p className="text-[17px] font-bold leading-tight mt-1">Isso aqui veio de usuário, e já está no app</p>
      </Entra>

      {/* Pilha: as de trás só aparecem pelas bordas, que é o que diz "tem mais". */}
      <Entra i={1}>
        <div className="relative mt-5 mx-auto" style={{ maxWidth: 300, height: 150 }}>
          {PEDIDOS.map((p, i) => {
            const atras = PEDIDOS.length - 1 - i;
            return (
              <div
                key={p}
                className={`absolute inset-x-0 top-0 p-4 ${CARD}`}
                style={{
                  transform: `translateY(${atras * 11}px) scale(${1 - atras * 0.05})`,
                  opacity: atras === 0 ? 1 : 0.45 - atras * 0.12,
                  zIndex: 10 - atras,
                  background: 'rgba(20,24,21,0.96)',
                }}
              >
                <span
                  className="w-7 h-7 rounded-full grid place-items-center"
                  style={{ background: VERDE }}
                >
                  <Check size={15} className="text-[#08210f]" strokeWidth={3} aria-hidden />
                </span>
                <p className="text-[15px] font-bold leading-snug mt-3">{p}</p>
                <p className="text-[11px] text-white/30 mt-4">pedido de quem usa</p>
              </div>
            );
          })}
        </div>
      </Entra>

      <div className="mt-4 space-y-2.5">
        {[
          ['Ficou com dúvida?', 'Suporte direto pelo app, ou pelo e-mail contato@forsora.com'],
          ['Quer uma funcionalidade nova?', 'É só sugerir uma melhoria no app'],
        ].map(([t, s], i) => (
          <Entra key={t} i={i + 2}>
            <div>
              <p className="text-[13px] font-bold">{t}</p>
              <p className="text-[12px] text-white/40">{s}</p>
            </div>
          </Entra>
        ))}
      </div>
    </Tela>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   9 · CONTAS
   ══════════════════════════════════════════════════════════════════════════ */

const CONTAS = [
  { banco: 'Nubank', logo: '/brands/nubank.png', itens: [
    { nome: 'Conta principal', tipo: 'Conta corrente', valor: 'R$ 8.420,00', Icone: null },
    { nome: 'Cartão Nubank', tipo: 'Cartão de crédito', valor: 'R$ 1.289,30', Icone: null },
    { nome: 'CDB', tipo: 'Renda fixa · 1 posição', valor: 'R$ 3.386,30', Icone: Lock },
    { nome: 'ETF', tipo: 'Renda variável · 1 posição', valor: 'R$ 1.500,00', Icone: LineChart },
  ] },
  { banco: 'Itaú', logo: '/brands/itau.png', itens: [
    { nome: 'Conta Itaú', tipo: 'Conta corrente', valor: 'R$ 1.243,80', Icone: null },
  ] },
];

export function MockContas() {
  return (
    <Tela className="pt-4">
      <Entra i={0}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/35 flex items-center gap-1.5">
          <ClipboardList size={11} aria-hidden /> Saldo total
        </p>
        <p className="text-[32px] font-bold tabular-nums tracking-tight leading-none mt-1">R$ 9.663,80</p>
      </Entra>

      <div className="mt-4 space-y-3">
        {CONTAS.map((b, bi) => (
          <Entra key={b.banco} i={bi + 1}>
            <div className={`overflow-hidden ${CARD}`}>
              <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-white/[0.06]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.logo} alt="" className="w-6 h-6 rounded-md object-cover" />
                <span className="text-[13px] font-bold">{b.banco}</span>
              </div>
              <div className="divide-y divide-white/[0.05]">
                {b.itens.map((it) => (
                  <div key={it.nome} className="flex items-center gap-2.5 px-3 py-2.5">
                    <span className="w-7 h-7 rounded-lg grid place-items-center overflow-hidden bg-white/[0.06] flex-shrink-0">
                      {it.Icone
                        ? <it.Icone size={13} className="text-white/55" aria-hidden />
                        // eslint-disable-next-line @next/next/no-img-element
                        : <img src={b.logo} alt="" className="w-full h-full object-cover" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-semibold truncate">{it.nome}</span>
                      <span className="block text-[10px] text-white/35 truncate">{it.tipo}</span>
                    </span>
                    <span className="text-[12.5px] font-bold tabular-nums">{it.valor}</span>
                  </div>
                ))}
              </div>
            </div>
          </Entra>
        ))}
      </div>

      <Entra i={4}>
        <p className="text-[10.5px] text-white/30 text-center mt-3">
          Open Finance · regulado pelo Banco Central
        </p>
      </Entra>
    </Tela>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   DESPACHO
   ══════════════════════════════════════════════════════════════════════════ */

const ARTES: Record<string, () => React.JSX.Element> = {
  whatsapp: MockConversa,
  categorias: MockCategorias,
  calendario: MockCalendario,
  limites: MockLimites,
  assinaturas: MockAssinaturas,
  projecao: MockProjecao,
  proventos: MockProventos,
  pedidos: MockPedidos,
  contas: MockContas,
};

export function ArteSlide({ slide }: { slide: Slide }) {
  const Arte = ARTES[slide.id];
  return Arte ? <Arte /> : null;
}
