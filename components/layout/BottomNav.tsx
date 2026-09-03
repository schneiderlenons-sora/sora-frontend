'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { mutate } from 'swr';
import {
  Home, List, Plus, BarChart2, User,
  LayoutDashboard, ArrowLeftRight, Receipt, FileBarChart,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from 'next-themes';
import { api } from '@/lib/api';
import { navPaleta } from '@/lib/nav-cores';
import QuickAddSheet from '@/components/dashboard/QuickAddSheet';
import NovaTransacaoModal from '@/components/dashboard/NovaTransacaoModal';

// =============================================================================
// Barra de navegação inferior — SÓ mobile (md:hidden).
//
// ── O DESENHO ────────────────────────────────────────────────────────────────
//
// A aba ativa SOBE pra fora da barra, dentro de um círculo, e a superfície
// abre um entalhe embaixo dela. Ao trocar de aba, o entalhe DESLIZA até a nova
// posição e o ícone anterior desce. É o padrão das referências, e o movimento
// não é enfeite: ele carrega a informação "de onde pra onde você foi" — regra
// `motion-meaning` da ui-ux-pro-max.
//
// ⚠️ A SUPERFÍCIE É NEUTRA (quase preta), NÃO o verde da sidebar. Com o fundo
// colorido, a cor da marca não marcaria mais nada — ela precisa sobrar pra
// apontar onde você está. É a regra `visual-hierarchy` (hierarquia por
// contraste, não por cor em tudo).
//
// ⚠️ SÃO 4 DESTINOS, e o "+" ficou FORA da barra. Ele era a fatia do meio, e
// com o entalhe viajando os dois brigavam por espaço — ver o comentário no
// próprio botão, mais abaixo.
//
// ── ACESSIBILIDADE ───────────────────────────────────────────────────────────
//
// · Cada alvo ocupa a fatia inteira (~94×62px em 375px) — bem acima dos 44pt.
// · A aba ativa é marcada por POSIÇÃO (sobe), FORMA (entalhe) e cor. Nunca só
//   por cor (`color-not-only`).
// · O rótulo da aba ativa continua no DOM (`sr-only`) — some da tela porque o
//   círculo ocupa o lugar, mas o leitor de tela e o `aria-current` seguem
//   dizendo onde a pessoa está.
// · `prefers-reduced-motion` corta o deslize (o CSS está em globals.css).
// =============================================================================

type Slot =
  | { tipo: 'link'; href: string; icon: any; label: string }
  | { tipo: 'menu'; icon: any; label: string };


export default function BottomNav({ onPerfil }: { onPerfil: () => void }) {
  const pathname = usePathname();
  const { phone } = useAuth();
  const { theme } = useTheme();
  const [quickOpen, setQuickOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [wallets, setWallets] = useState<any[]>([]);

  // Pré-carrega as contas quando o menu de adicionar abre (pro modal já vir pronto).
  useEffect(() => {
    if (!(quickOpen || modalOpen) || !phone || wallets.length) return;
    api.wallets.listar(phone).then(w => setWallets(w || [])).catch(() => setWallets([]));
  }, [quickOpen, modalOpen, phone, wallets.length]);

  // `mounted` evita hydration mismatch: no servidor não há tema resolvido.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  // ⚠️ A MESMA paleta que pinta a faixa de segurança abaixo da barra (o
  // DashboardLayout lê daqui também). Foi a divergência entre os dois que
  // criava o degrau de cor logo abaixo dela.
  const paleta = navPaleta(theme, mounted);

  // No painel Negócios a barra leva às telas DO NEGÓCIO. Com os atalhos do app
  // pessoal, cada toque no mobile jogava o usuário pra fora do painel — o
  // oposto de "painel único". O "+" (transação pessoal) também não cabe aqui.
  const ehNegocios = !!pathname?.startsWith('/negocios');

  const slots: Slot[] = useMemo(() => (ehNegocios
    ? [
        { tipo: 'link', href: '/negocios',        icon: LayoutDashboard, label: 'Painel' },
        { tipo: 'link', href: '/negocios/caixa',  icon: ArrowLeftRight,  label: 'Caixa' },
        { tipo: 'link', href: '/negocios/contas', icon: Receipt,         label: 'A pagar' },
        { tipo: 'link', href: '/negocios/dre',    icon: FileBarChart,    label: 'DRE' },
        { tipo: 'menu', icon: User, label: 'Menu' },
      ]
    : [
        { tipo: 'link', href: '/dashboard',  icon: Home,      label: 'Início' },
        { tipo: 'link', href: '/transacoes', icon: List,      label: 'Transações' },
        { tipo: 'link', href: '/relatorios', icon: BarChart2, label: 'Relatórios' },
        { tipo: 'menu', icon: User, label: 'Menu' },
      ]), [ehNegocios]);

  // ⚠️ Qual fatia está ativa. Casa a rota MAIS ESPECÍFICA: sem isso,
  // `/negocios` casaria com `/negocios/caixa` e o entalhe apontaria a aba
  // errada dentro do painel de Negócios.
  const ativoIdx = useMemo(() => {
    let melhor = -1;
    let tamanho = -1;
    slots.forEach((s, i) => {
      if (s.tipo !== 'link') return;
      const casa = pathname === s.href || pathname?.startsWith(s.href + '/');
      if (casa && s.href.length > tamanho) { melhor = i; tamanho = s.href.length; }
    });
    return melhor;
  }, [slots, pathname]);

  // ═════════════════════════════════════════════════════════════════════════
  // ⚠️ A BARRA AGE NO PONTEIRO, NÃO NO CLIQUE. É a correção do "toco na aba e
  // não abre; na segunda ou terceira vez vai".
  //
  // No iOS, um toque dado enquanto a página ainda rola por INÉRCIA é consumido
  // pra PARAR a rolagem — e o `click` sintetizado nunca chega. `pointerdown` e
  // `pointerup` chegam. Como `<Link>` depende de `click`, o primeiro toque
  // depois de rolar simplesmente não fazia nada. Daí a intermitência: dependia
  // de a pessoa ter rolado antes de tocar.
  //
  // Navego no `pointerup` (e não no `down`) de propósito: é o que preserva o
  // "arrastar pra fora cancela", que todo tab bar nativo tem.
  //
  // O `<Link>` CONTINUA sendo um link de verdade — teclado, leitor de tela e
  // abrir em nova aba seguem funcionando. `jaNavegou` evita a navegação em
  // dobro quando o clique também chega, e é zerado no `pointerdown` pra que o
  // teclado (que não tem ponteiro) nunca caia no caminho de cancelamento.
  // ═════════════════════════════════════════════════════════════════════════
  const router = useRouter();
  const jaNavegou = useRef(false);

  // Fatia que o dedo escolheu, antes de a rota chegar. Sem isso a bolha só
  // sairia do lugar depois do servidor responder, e o toque pareceria ignorado
  // mesmo quando funcionou.
  const [otimista, setOtimista] = useState<number | null>(null);
  useEffect(() => { setOtimista(null); }, [pathname]);

  const n = slots.length;
  const fatia = 100 / n;
  const idxVisual = otimista ?? ativoIdx;
  const temAtivo = idxVisual >= 0;
  // Centro da fatia ativa, em % da largura da barra.
  const centro = (idxVisual + 0.5) * fatia;

  // ⚠️ O RAIO NUNCA VAI A ZERO — E ISSO NÃO É ESTILO, É O BUG DA BARRA SUMIR.
  //
  // Antes, em rota fora da barra (ex.: /contas-bancarias, /grow/habitos), eu
  // fechava o entalhe com `--sora-notch-r: 0px`. Isso produz
  // `radial-gradient(circle 0px …)`, que é um gradiente DEGENERADO — e os
  // motores discordam sobre o que fazer com ele. Medido numa bancada: o
  // Chromium desenha a barra inteira; o **WebKit do iOS trata como
  // transparente e APAGA A SUPERFÍCIE TODA**. Sobravam só os ícones (que ficam
  // noutra camada, sem máscara) e o conteúdo da página passava por baixo.
  //
  // Também era a causa do "+ duplicado": com a barra transparente, botões que
  // sempre estiveram ATRÁS dela ficaram à vista.
  //
  // A correção é manter o gradiente sempre VÁLIDO e tirar o buraco de cena
  // pela POSIÇÃO. Fora da barra ele vai pra -30%, ou seja, inteiramente fora
  // do elemento: a superfície fica cheia, e a transição continua animando
  // (o entalhe entra e sai deslizando pela lateral).
  const estiloSuperficie: React.CSSProperties & Record<string, string> = {
    background: paleta.superficie,
    ['--sora-notch']: `${temAtivo ? centro : -30}%`,
    ['--sora-notch-r']: '34px',
  };

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40"
        aria-label={ehNegocios ? 'Navegação do painel Negócios' : 'Navegação principal'}
      >
        <div className="relative" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          {/* ── Camada 1: a superfície, com o entalhe recortado ──────────────
              Fica separada dos itens de propósito: a máscara recorta TUDO que
              está dentro dela, então os ícones sumiriam junto com o buraco. */}
          <div
            aria-hidden
            className="sora-nav-surface absolute inset-0"
            style={estiloSuperficie}
          />
          {/* Fio de luz no topo — some no entalhe junto com a superfície, o que
              é justamente o que faz a curva parecer recortada e não desenhada. */}
          <div
            aria-hidden
            className="sora-nav-surface absolute inset-0"
            style={{
              ...estiloSuperficie,
              background: paleta.fio,
            }}
          />

          {/* ── Camada 2: a bolha da aba ativa ───────────────────────────────
              ⚠️ `pointer-events-none`: ela FLUTUA por cima da barra e passa da
              borda superior. Sem isso ela roubaria o toque de quem tocasse ali
              — e a metade de cima nem está sobre a barra, estaria roubando o
              toque do CONTEÚDO da página. O alvo continua sendo o link da
              fatia, que segue com a área inteira. */}
          <div
            aria-hidden
            className="absolute left-0 top-0 pointer-events-none transition-[transform,opacity] duration-[460ms] motion-reduce:transition-none"
            style={{
              width: `${fatia}%`,
              // Curva com leve passagem do ponto — é ela que dá peso ao
              // movimento. Linear pareceria uma planilha animando.
              transitionTimingFunction: 'cubic-bezier(0.34, 1.32, 0.5, 1)',
              transform: `translateX(${(temAtivo ? idxVisual : Math.floor(n / 2)) * 100}%)`,
              opacity: temAtivo ? 1 : 0,
            }}
          >
            <div
              className="mx-auto grid place-items-center rounded-full transition-transform duration-[460ms] motion-reduce:transition-none"
              style={{
                width: 48, height: 48,
                marginTop: -24,           // metade pra fora da barra
                background: 'hsl(var(--primary))',
                boxShadow: '0 8px 20px -6px hsl(var(--primary) / 0.65)',
                transform: temAtivo ? 'scale(1)' : 'scale(0.6)',
                transitionTimingFunction: 'cubic-bezier(0.34, 1.32, 0.5, 1)',
              }}
            >
              {temAtivo && (() => {
                const s = slots[idxVisual];
                const Icone = s.tipo === 'link' ? s.icon : User;
                return <Icone size={22} strokeWidth={2.6} className="text-white" />;
              })()}
            </div>
          </div>

          {/* ── Camada 3: os alvos de toque ──────────────────────────────── */}
          <div className="relative flex items-stretch" style={{ height: 62 }}>
            {slots.map((s, i) => {
              const ativo = i === idxVisual;
              // O conteúdo visível some quando a fatia está ativa: quem mostra
              // o ícone ali é a bolha. O rótulo continua no DOM pro leitor de
              // tela (`sr-only`) — sumir da tela não é sumir da semântica.
              const miolo = (
                <span
                  className="flex flex-col items-center justify-center gap-1 transition-[opacity,transform] duration-300 motion-reduce:transition-none"
                  style={{
                    opacity: ativo ? 0 : 1,
                    transform: ativo ? 'translateY(6px)' : 'translateY(0)',
                  }}
                  aria-hidden={ativo}
                >
                  <s.icon size={21} strokeWidth={2} style={{ color: paleta.item }} />
                  <span className="text-[10px] font-medium leading-none" style={{ color: paleta.item }}>{s.label}</span>
                </span>
              );

              const classes =
                'flex-1 min-w-0 flex items-center justify-center active:opacity-60 transition-opacity';

              if (s.tipo === 'menu') {
                return (
                  <button
                    key="menu"
                    aria-label={s.label}
                    className={classes}
                    // Mesmo motivo dos links: no zap do scroll por inércia o
                    // clique some, e era isso que fazia o menu pedir 3 toques.
                    onPointerDown={() => { jaNavegou.current = false; }}
                    onPointerUp={() => { jaNavegou.current = true; onPerfil(); }}
                    onClick={() => { if (jaNavegou.current) { jaNavegou.current = false; return; } onPerfil(); }}
                  >
                    {miolo}
                  </button>
                );
              }

              return (
                <Link
                  key={s.href}
                  href={s.href}
                  aria-label={s.label}
                  aria-current={ativo ? 'page' : undefined}
                  className={classes}
                  onPointerDown={() => { jaNavegou.current = false; setOtimista(i); }}
                  onPointerUp={() => { jaNavegou.current = true; router.push(s.href); }}
                  // Saiu de cima antes de soltar = desistiu. Devolve a bolha
                  // pra fatia real, senão ela ficaria mentindo onde você está.
                  onPointerCancel={() => setOtimista(null)}
                  onPointerLeave={() => setOtimista(null)}
                  onClick={(e) => { if (jaNavegou.current) { e.preventDefault(); jaNavegou.current = false; } }}
                >
                  {miolo}
                  {ativo && <span className="sr-only">{s.label}</span>}
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── O "+" FLUTUA FORA DA BARRA ─────────────────────────────────────
            ⚠️ Ele ERA a fatia do meio, e ali não cabia mais. Com o entalhe
            viajando, quando a aba ativa era vizinha do "+" os dois ficavam
            colados — sobrava um fiapo de barra de 15px entre a bolha e o botão,
            e lia como defeito, não como desenho. Medi isso numa bancada antes
            de mexer: com 5 fatias em 375px cada uma tem 75px, e entalhe (68px)
            mais botão (52px) não convivem lado a lado.
            Fora da barra o problema deixa de existir, e é o que as referências
            fazem: barra de 4 destinos + ação flutuando por cima.
            ⚠️ À DIREITA, não ao centro: é onde o polegar chega sem esticar, e
            no centro ele voltaria a disputar espaço com as fatias 1 e 2. */}
        {!ehNegocios && (
          <button
            aria-label="Registrar lançamento"
            onPointerDown={() => { jaNavegou.current = false; }}
            onPointerUp={() => { jaNavegou.current = true; setQuickOpen(true); }}
            onClick={() => { if (jaNavegou.current) { jaNavegou.current = false; return; } setQuickOpen(true); }}
            className="absolute right-4 grid place-items-center rounded-2xl text-white active:scale-90 transition-transform"
            style={{
              width: 48, height: 48,
              bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)',
              background: 'linear-gradient(135deg, hsl(var(--primary)), #3dd68c)',
              boxShadow: paleta.sombraMais,
            }}
          >
            <Plus size={24} strokeWidth={2.8} />
          </button>
        )}
      </nav>

      {!ehNegocios && (
        <>
          <QuickAddSheet
            open={quickOpen}
            onClose={() => setQuickOpen(false)}
            onNovaTransacao={() => setModalOpen(true)}
          />
          {modalOpen && (
            <NovaTransacaoModal
              phone={phone}
              wallets={wallets}
              onClose={() => setModalOpen(false)}
              onSuccess={() => { mutate(() => true); }}
            />
          )}
        </>
      )}
    </>
  );
}
