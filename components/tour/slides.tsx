'use client';

import Image from 'next/image';

/**
 * Os 8 slides da demonstração.
 *
 * ⚠️ A ARTE É REAL. Sete slides usam as telas de `public/screenshots/` — as
 * mesmas do carrossel da landing. Mockup inventado numa demo de produto
 * financeiro é promessa que a primeira tela do app desmente.
 *
 * O slide 1 é a exceção e é MOCK EM CSS de propósito: não existe screenshot do
 * WhatsApp no repo, e a conversa é justamente o que a Sora tem de diferente —
 * abrir por ela vale mais que abrir por um dashboard bonito. Feito em JSX, ele
 * é nítido em qualquer densidade, pesa zero byte e ainda anima.
 */

export type Slide = {
  id: string;
  /** A palavra que ganha o traço da marca. Tem de existir dentro de `titulo`. */
  destaque: string;
  titulo: string;
  texto: string;
  arte: { tipo: 'img'; src: string } | { tipo: 'jsx' };
};

export const SLIDES: Slide[] = [
  {
    id: 'whatsapp',
    titulo: 'Mande no WhatsApp, a Sora lança',
    destaque: 'no WhatsApp',
    texto: '"Gastei 50 no mercado" e pronto: valor, categoria e conta certos, sem abrir o app.',
    arte: { tipo: 'jsx' },
  },
  {
    id: 'dashboard',
    titulo: 'Tudo que entra e sai, num lugar só',
    destaque: 'num lugar só',
    texto: 'Saldo, gastos do mês e o que ainda vai vencer — na primeira tela, sem procurar.',
    arte: { tipo: 'img', src: '/screenshots/finance-dashboard.jpeg' },
  },
  {
    id: 'categorias',
    titulo: 'Suas compras viram categorias sozinhas',
    destaque: 'sozinhas',
    texto: 'A Sora reconhece o estabelecimento e categoriza. O que você corrigir uma vez, ela lembra.',
    arte: { tipo: 'img', src: '/screenshots/finance-transacoes.png' },
  },
  {
    id: 'cartao',
    titulo: 'A fatura pelo ciclo real do cartão',
    destaque: 'ciclo real',
    texto: 'Do fechamento ao fechamento, como o banco faz — não pelo mês do calendário.',
    arte: { tipo: 'img', src: '/screenshots/finance-cartao.png' },
  },
  {
    id: 'limites',
    titulo: 'Saiba que vai estourar antes de estourar',
    destaque: 'antes de estourar',
    texto: 'Limite por categoria com barra de consumo, e aviso quando você chega perto.',
    arte: { tipo: 'img', src: '/screenshots/finance-limites.png' },
  },
  {
    id: 'metas',
    titulo: 'Metas que andam com o seu dinheiro',
    destaque: 'andam',
    texto: 'Guardou, a meta sobe. Sem planilha paralela e sem lançar duas vezes.',
    arte: { tipo: 'img', src: '/screenshots/finance-metas.jpeg' },
  },
  {
    id: 'investimentos',
    titulo: 'Sua carteira e o que ela rende',
    destaque: 'o que ela rende',
    texto: 'Patrimônio, rentabilidade, proventos e reserva de emergência no mesmo painel.',
    arte: { tipo: 'img', src: '/screenshots/finance-investimentos.png' },
  },
  {
    id: 'grow',
    titulo: 'Não é só dinheiro: é sua rotina',
    destaque: 'sua rotina',
    texto: 'Hábitos, tarefas e bem-estar junto das finanças — porque uma coisa puxa a outra.',
    arte: { tipo: 'img', src: '/screenshots/grow-dashboard.png' },
  },
];

/* ── Mock da conversa (slide 1) ───────────────────────────────────────────── */

function Bolha({ minha, children, atraso }: { minha?: boolean; children: React.ReactNode; atraso: number }) {
  return (
    <div
      className={`flex ${minha ? 'justify-end' : 'justify-start'} motion-safe:animate-[slide-up_500ms_ease-out_both]`}
      style={{ animationDelay: `${atraso}ms` }}
    >
      <div
        className={`max-w-[82%] px-3.5 py-2.5 text-[13.5px] leading-relaxed shadow-lg ${
          minha
            ? 'rounded-2xl rounded-br-md text-[#0A2A14]'
            : 'rounded-2xl rounded-bl-md text-white/95'
        }`}
        style={{ background: minha ? '#61ce70' : 'rgba(255,255,255,0.09)' }}
      >
        {children}
      </div>
    </div>
  );
}

export function MockConversa() {
  return (
    <div className="w-full h-full flex items-end justify-center px-5 pb-4">
      <div className="w-full max-w-[330px] space-y-2.5">
        <Bolha minha atraso={120}>Gastei 50 no mercado</Bolha>

        <Bolha atraso={520}>
          <span className="font-semibold">Anotado! 💚</span>
          <br />
          🛒 R$ 50,00 · Supermercado
          <br />
          <span className="text-white/60">Nubank · hoje</span>
        </Bolha>

        <Bolha minha atraso={1000}>quanto gastei com mercado esse mês?</Bolha>

        <Bolha atraso={1400}>
          Você gastou <span className="font-semibold">R$ 412,80</span> em Supermercado em setembro —
          12% a menos que em agosto.
        </Bolha>
      </div>
    </div>
  );
}

/* ── Arte de um slide ─────────────────────────────────────────────────────── */

export function ArteSlide({ slide, prioridade }: { slide: Slide; prioridade: boolean }) {
  if (slide.arte.tipo === 'jsx') return <MockConversa />;

  return (
    <Image
      src={slide.arte.src}
      alt=""
      fill
      // ⚠️ `sizes` é OBRIGATÓRIO. Sem ele o Next assume 100vw e serve a maior
      // variante da imagem, desfazendo a otimização — a regra já documentada em
      // AgentesShowcase.
      sizes="(max-width: 640px) 100vw, 440px"
      // Só as duas primeiras entram ansiosas: o resto chega enquanto a pessoa lê.
      priority={prioridade}
      // `object-top` porque o topo da tela é onde está a informação; cortar por
      // baixo perde menos que centralizar.
      className="object-cover object-top"
      // Decorativa: o texto do slide já diz tudo, e um alt descritivo aqui só
      // faria o leitor de tela repetir o título.
      aria-hidden
    />
  );
}
