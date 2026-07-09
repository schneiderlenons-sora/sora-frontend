'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';

// Depoimentos de figuras conhecidas. As frases combinam com a "vibe" de cada um.
// FOTOS: solte os arquivos em public/landing/depoimentos/<arquivo> que aparecem
// automaticamente; enquanto não existir, mostra as iniciais (sem imagem quebrada).
const DEPOIMENTOS = [
  {
    nome: 'Mari Gonzalez', role: 'Influenciadora & Empresária', cor: '#ec4899',
    img: '/landing/depoimentos/Mari-gonzales.jpg',
    quote: 'Amo praticidade! Mando um áudio e a Sora organiza meus gastos e minha agenda. Do jeitinho que eu preciso pra dar conta de tudo.',
  },
  {
    nome: 'Ferrugem', role: 'Cantor', cor: '#f59e0b',
    img: '/landing/depoimentos/ferrugem.jpg',
    quote: 'Rapaziada, testa aí! Eu só falo e ela anota tudo. Nunca mais esqueci uma conta nem um compromisso da família.',
  },
  {
    nome: 'Otaviano Costa', role: 'Apresentador', cor: '#61ce70',
    img: '/landing/depoimentos/otaviano-costa.jpg',
    quote: 'Minha rotina é uma correria de gravação e viagem. A Sora virou meu braço direito: mando um áudio e ela organiza as contas, a agenda e os lembretes. Recomendo demais!',
  },
  {
    nome: 'Duda Rubert', role: 'Influenciadora', cor: '#a855f7',
    img: '/landing/depoimentos/duda-rubert.jpg',
    quote: 'Gente, muito fácil! Só mando mensagem e tá tudo organizado — gastos, lembretes, tudo. Virei fã na primeira semana!',
  },
  {
    nome: 'Coringa', role: 'Criador de conteúdo', cor: '#3b82f6',
    img: '/landing/depoimentos/coringa.jpg',
    quote: 'Mano, que coisa útil! Eu falo e ela faz. Organiza documento, lembra de tudo… é tipo ter um assistente de verdade.',
  },
];

const METRICAS = [
  { valor: '12k+',   label: 'Usuários ativos' },
  { valor: 'R$ 18M', label: 'Movimentados por mês' },
  { valor: '+2M',    label: 'Lançamentos automáticos' },
  { valor: '4.9/5',  label: 'Avaliação dos usuários' },
];

function iniciais(nome: string) {
  return nome.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

// Lembra quais fotos ainda não existem — evita re-tentar o request (e floodar o
// console com 404) toda vez que o avatar remonta durante o carrossel.
const IMG_FALHOU = new Set<string>();

function Foto({ nome, img, cor, tamanho }: { nome: string; img: string; cor: string; tamanho: number }) {
  const [erro, setErro] = useState(() => IMG_FALHOU.has(img));
  return (
    <div className="rounded-full overflow-hidden grid place-items-center text-white font-bold flex-shrink-0"
         style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.32, background: `linear-gradient(135deg, ${cor}, ${escurecer(cor)})` }}>
      {!erro
        ? /* eslint-disable-next-line @next/next/no-img-element */
          <img src={img} alt={nome} onError={() => { IMG_FALHOU.add(img); setErro(true); }} className="w-full h-full object-cover" draggable={false} />
        : <span>{iniciais(nome)}</span>}
    </div>
  );
}

export default function SocialProof() {
  const [ativo, setAtivo] = useState(2);
  const [compact, setCompact] = useState(false); // avatares menores no mobile

  // auto-rotaciona o depoimento em destaque
  useEffect(() => {
    const iv = setInterval(() => setAtivo((a) => (a + 1) % DEPOIMENTOS.length), 8000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const upd = () => setCompact(mq.matches);
    upd();
    mq.addEventListener('change', upd);
    return () => mq.removeEventListener('change', upd);
  }, []);

  const N = DEPOIMENTOS.length;
  // exibição com o ATIVO sempre no centro (slot 2); vizinhos ao redor
  const ordem = [-2, -1, 0, 1, 2].map((d) => (ativo + d + N) % N);
  // tamanho por distância do centro (0 centro · 1 vizinho · 2 ponta) — centro
  // bem maior, tipo o modelo do meuassessor
  const tamPorDist = (dist: number) => (compact ? [104, 54, 36] : [160, 82, 54])[dist];

  return (
    <section className="relative py-24 lg:py-36 border-t border-zinc-200/50 dark:border-white/[0.04] overflow-hidden">
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] opacity-30 dark:opacity-20"
             style={{ background: 'radial-gradient(ellipse, rgba(97,206,112,0.16) 0%, transparent 62%)' }} />
      </div>

      <div className="relative max-w-6xl mx-auto px-5 sm:px-8">

        <div className="text-center mb-12 lg:mb-16">
          <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-500 dark:text-white/40 mb-4">Quem usa</p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-[-0.03em] max-w-3xl mx-auto">
            Milhares já transformaram<br />
            <span className="text-zinc-400 dark:text-white/30">a própria rotina.</span>
          </h2>
          <p className="mt-5 text-lg text-zinc-600 dark:text-white/60">Veja quem já vive no automático com a Sora.</p>
        </div>

        {/* Métricas — barra única com divisórias */}
        <div className="grid grid-cols-2 lg:grid-cols-4 rounded-3xl border border-zinc-200 dark:border-white/[0.06] bg-zinc-50/70 dark:bg-white/[0.02] overflow-hidden mb-16 lg:mb-20">
          {METRICAS.map((m, i) => (
            <div key={m.label}
                 className={`text-center px-4 py-7 ${i % 2 === 1 ? 'border-l' : ''} lg:border-l ${i === 0 ? 'lg:border-l-0' : ''} ${i >= 2 ? 'border-t lg:border-t-0' : ''} border-zinc-200 dark:border-white/[0.06]`}>
              <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-zinc-400 dark:text-white/40 mb-2">{m.label}</p>
              <p className="text-3xl sm:text-4xl font-bold tabular-nums tracking-tight text-zinc-900 dark:text-white">
                {m.valor.replace(/[+/%].*/, '')}
                <span style={{ color: '#61ce70' }}>{m.valor.match(/[+/%].*/)?.[0]}</span>
              </p>
            </div>
          ))}
        </div>

        {/* Carrossel de depoimentos */}
        <div className="flex flex-col items-center">
          {/* avatares — ativo no centro, diminuindo pras pontas.
              Altura FIXA (= central em repouso: tamanho + anel de 10px) pra que o
              encolher/crescer da transição não faça a fileira "afundar" e repicar. */}
          <div className="flex items-center justify-center gap-2.5 sm:gap-4"
               style={{ height: compact ? 114 : 170 }}>
            {ordem.map((idx, slot) => {
              const d = DEPOIMENTOS[idx];
              const dist = Math.abs(slot - 2);
              const on = dist === 0;
              const tamanho = tamPorDist(dist);
              const opacidade = dist === 0 ? 1 : dist === 1 ? 0.7 : 0.4;
              return (
                <button key={d.nome} onClick={() => setAtivo(idx)} aria-label={`Ver depoimento de ${d.nome}`}
                        className="rounded-full transition-all duration-500 focus:outline-none flex-shrink-0"
                        style={{ opacity: opacidade, filter: on ? 'none' : 'grayscale(0.35)' }}>
                  {/* Foto SEMPRE montada (mesma posição na árvore) — só muda tamanho/anel;
                      assim a imagem carrega uma vez e não re-requisita no carrossel. */}
                  <span className="block rounded-full transition-all duration-500"
                        style={{ padding: on ? 3 : 0, background: on ? `linear-gradient(135deg, ${d.cor}, ${escurecer(d.cor)})` : 'transparent' }}>
                    <span className="block rounded-full transition-all duration-500 bg-white dark:bg-[#0a0a0a]"
                          style={{ padding: on ? 2 : 0 }}>
                      <Foto nome={d.nome} img={d.img} cor={d.cor} tamanho={tamanho} />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* destaque — TODOS empilhados na mesma célula de grid ([grid-area:1/1])
              pra reservar a altura do MAIOR depoimento; só o ativo fica visível
              (crossfade por opacidade). Assim trocar de depoimento não muda a
              altura da seção → sem pulo/CLS em mobile nem desktop. */}
          <div className="mt-8 grid w-full max-w-2xl">
            {DEPOIMENTOS.map((d, i) => {
              const on = i === ativo;
              return (
                <div key={d.nome} aria-hidden={!on}
                     className="[grid-area:1/1] text-center transition-opacity duration-500"
                     style={{ opacity: on ? 1 : 0, pointerEvents: on ? 'auto' : 'none' }}>
                  <p className="font-bold text-xl text-zinc-900 dark:text-white">{d.nome}</p>
                  <p className="text-sm text-zinc-500 dark:text-white/50 mt-0.5">{d.role}</p>
                  <p className="mt-5 text-[15px] sm:text-base font-normal leading-relaxed text-zinc-600 dark:text-white/70">
                    “{d.quote}”
                  </p>
                  <div className="flex items-center justify-center gap-1 mt-5">
                    {Array.from({ length: 5 }).map((_, n) => (
                      <Star key={n} size={18} fill="#fbbf24" stroke="#fbbf24" />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function escurecer(hex: string, amt = 0.2): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - Math.round(255 * amt));
  const g = Math.max(0, ((n >> 8) & 0xff) - Math.round(255 * amt));
  const b = Math.max(0, (n & 0xff) - Math.round(255 * amt));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
