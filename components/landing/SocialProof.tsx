'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';

// Depoimentos de figuras conhecidas. As frases combinam com a "vibe" de cada um.
// FOTOS: solte os arquivos em public/landing/depoimentos/<arquivo> que aparecem
// automaticamente; enquanto não existir, mostra as iniciais (sem imagem quebrada).
const DEPOIMENTOS = [
  {
    nome: 'Jade Picon', role: 'Influenciadora & Empresária', cor: '#ec4899',
    img: '/landing/depoimentos/jade-picon.jpg',
    quote: 'Amo praticidade! Mando um áudio e a Sora organiza meus gastos e minha agenda. Do jeitinho que eu preciso pra dar conta de tudo.',
  },
  {
    nome: 'Ferrugem', role: 'Cantor', cor: '#f59e0b',
    img: '/landing/depoimentos/ferrugem.jpg',
    quote: 'Rapaziada, testa aí! Eu só falo e ela anota tudo. Nunca mais esqueci uma conta nem um compromisso da família.',
  },
  {
    nome: 'Gusttavo Lima', role: 'Cantor & Empresário', cor: '#61ce70',
    img: '/landing/depoimentos/gusttavo-lima.jpg',
    quote: 'Como empresário, controle é tudo. A Sora deixa minhas finanças e minha agenda na palma da mão. Recomendo demais!',
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

  // auto-rotaciona o depoimento em destaque
  useEffect(() => {
    const iv = setInterval(() => setAtivo((a) => (a + 1) % DEPOIMENTOS.length), 4500);
    return () => clearInterval(iv);
  }, []);

  const cur = DEPOIMENTOS[ativo];

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
          {/* avatares */}
          <div className="flex items-center justify-center gap-2.5 sm:gap-4">
            {DEPOIMENTOS.map((d, i) => {
              const on = i === ativo;
              return (
                <button key={d.nome} onClick={() => setAtivo(i)} aria-label={`Ver depoimento de ${d.nome}`}
                        className="rounded-full transition-all duration-300 focus:outline-none"
                        style={{ opacity: on ? 1 : 0.45, filter: on ? 'none' : 'grayscale(0.4)' }}>
                  {/* Foto SEMPRE montada (mesma posição na árvore) — só muda tamanho/anel;
                      assim a imagem carrega uma vez e não re-requisita no carrossel. */}
                  <span className="block rounded-full transition-all duration-300"
                        style={{ padding: on ? 3 : 0, background: on ? `linear-gradient(135deg, ${d.cor}, ${escurecer(d.cor)})` : 'transparent' }}>
                    <span className="block rounded-full transition-all duration-300 bg-white dark:bg-[#0a0a0a]"
                          style={{ padding: on ? 2 : 0 }}>
                      <Foto nome={d.nome} img={d.img} cor={d.cor} tamanho={on ? 92 : 56} />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* destaque */}
          <div key={ativo} className="mt-8 text-center max-w-2xl animate-[fade-in_400ms_ease-out]">
            <p className="font-bold text-xl text-zinc-900 dark:text-white">{cur.nome}</p>
            <p className="text-sm text-zinc-500 dark:text-white/50 mt-0.5">{cur.role}</p>
            <p className="mt-5 text-lg sm:text-2xl font-medium leading-relaxed text-zinc-700 dark:text-white/80">
              “{cur.quote}”
            </p>
            <div className="flex items-center justify-center gap-1 mt-5">
              {Array.from({ length: 5 }).map((_, n) => (
                <Star key={n} size={18} fill="#fbbf24" stroke="#fbbf24" />
              ))}
            </div>
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
