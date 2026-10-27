/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { X, Check, Loader2, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEhAppNativo } from '@/lib/useOrigem';
import { planoMinimo, type Feature } from '@/lib/plans';
import { PLANOS_DISPLAY } from '@/lib/planos-display';
import { PLANOS_INFO } from '@/lib/stripe';
import { LINK_PLAY_STORE } from '@/lib/play-store';
import { ORDEM_PLAY, produtoPlay, type PlanoPlay, type IntervaloPlay } from '@/lib/play-billing';
import { trackAddToCart, trackInitiateCheckout } from '@/lib/analytics';
import { usePlayCompra, precoTexto } from '../usePlayCompra';
import Celulares, { type TelaCentro } from './Celulares';

// ─────────────────────────────────────────────────────────────────────────────
// O PAYWALL DA ABA BLOQUEADA — pra quem está no modo grátis (ou sem plano).
//
// Dentro do app Android vende pela Google Play (usePlayCompra); no site, pelo
// Stripe (o mesmo /api/stripe/checkout da /planos). Quem já paga por fora, é
// vitalício ou Kit não chega aqui: o AbaBloqueada decide antes.
//
// ⚠️ SÓ APARECEM OS PLANOS QUE DESTRAVAM A ABA TOCADA. Quem toca em Saúde não
// vê o Básico: oferecer um plano que não abre a aba que a pessoa pediu é o
// tipo de venda que vira reclamação no dia seguinte.
//
// ⚠️ NO APP NÃO SE FALA DO SITE NEM DE OUTRO MEIO DE PAGAMENTO (anti-steering
// da Play). O texto de rodapé muda conforme o canal.
//
// ⚠️ O que cada plano "destrava" foi conferido contra `lib/plans.ts` (FEATURES
// e LIMITES). Mexeu em plano lá, confira esta lista — ela é promessa de venda.
// ─────────────────────────────────────────────────────────────────────────────

type Destaque = { forte: string; resto?: string };

const DESTRAVA: Record<PlanoPlay, Destaque[]> = {
  basico: [
    { forte: 'WhatsApp', resto: ': lance gastos por texto ou áudio, sem abrir o app' },
    { forte: '1 banco conectado', resto: ' pelo Open Finance, com tudo entrando sozinho' },
    { forte: 'Agenda', resto: ' com contas, faturas e compromissos num só lugar' },
    { forte: 'Agentes', resto: ' que acham lançamento repetido pra você' },
    { forte: 'Drive', resto: ' pra guardar comprovantes e documentos' },
    { forte: 'Sora Wrapped', resto: ': a retrospectiva do seu dinheiro' },
  ],
  premium: [
    { forte: 'Tudo do Básico' },
    { forte: '3 bancos conectados', resto: ' pelo Open Finance' },
    { forte: 'Foto da nota', resto: ' vira lançamento sozinha' },
    { forte: 'Contas e cartões sem limite' },
    { forte: 'Investimentos', resto: ' e reserva de emergência no mesmo painel' },
    { forte: 'Gestão compartilhada', resto: ' pra casal ou família' },
    { forte: 'Sora Grow completo', resto: ': saúde, estudos, casa, viagens e leituras' },
    { forte: 'Oráculo', resto: ': pergunte se a compra cabe no bolso' },
  ],
  platinum: [
    { forte: 'Tudo do Premium' },
    { forte: '5 bancos conectados', resto: ' pelo Open Finance' },
    { forte: 'Painel de negócios', resto: ': DRE, vendas, estoque e fluxo de caixa' },
    { forte: 'Equipe e folha', resto: ' com comissão por venda' },
    { forte: 'Integrações', resto: ' com Hotmart, Kiwify e Eduzz' },
    { forte: 'Venda pelo WhatsApp', resto: ': "vendi 3 bolos por 90 pra dona Maria"' },
    { forte: 'Suporte prioritário' },
  ],
};

/** Cor de cada plano dentro do paywall (o fundo é oceano, não a paleta do app). */
const COR: Record<PlanoPlay, { base: string; escura: string; texto: string }> = {
  basico: { base: '#D5DEDA', escura: '#A9B7B1', texto: '#0B201B' },
  premium: { base: '#61CE70', escura: '#3FA85A', texto: '#06200F' },
  platinum: { base: '#B9A6FF', escura: '#8B72F0', texto: '#160B33' },
};

const BANCOS = ['nubank', 'itau', 'bradesco', 'santander', 'inter', 'banco-do-brasil'];

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function telaDoCentro(feature: Feature): TelaCentro {
  if (feature === 'open_finance') return 'bancos';
  if (feature === 'grow_saude') return 'saude';
  if (feature === 'grow_agenda') return 'agenda';
  return 'chat';
}

/** O que o celular do meio mostra, dito pro leitor de tela. */
const DESCRICAO_CENTRO: Record<TelaCentro, string> = {
  chat: 'uma conversa com a Sora no WhatsApp',
  bancos: 'os bancos conectados pelo Open Finance',
  saude: 'os macros de uma refeição analisada por foto',
  agenda: 'o calendário com contas e compromissos',
};

export default function PaywallPlanos({ feature, chamada, texto }: { feature: Feature; chamada: string; texto: string }) {
  const router = useRouter();
  const { plano: planoAtual } = useAuth();
  const nativo = useEhAppNativo();
  const compra = usePlayCompra(nativo);
  const { status, disponivel, precos, erroPreco, motivoIndisponivel, comprando, aviso } = compra;
  const celular = useCelular();

  // Planos oferecidos: os que destravam a aba, e — pra quem já assina pela
  // Play — só os acima do atual (trocar pra baixo não destrava nada aqui).
  const planos = useMemo(() => {
    const min = ORDEM_PLAY[(planoMinimo(feature) as PlanoPlay)] ?? 1;
    const atual = nativo && status?.ativa && status.plano ? ORDEM_PLAY[status.plano] : 0;
    return PLANOS_DISPLAY
      .filter((p) => p.id in ORDEM_PLAY)
      .filter((p) => ORDEM_PLAY[p.id as PlanoPlay] >= min && ORDEM_PLAY[p.id as PlanoPlay] > atual)
      .map((p) => ({ ...p, id: p.id as PlanoPlay }));
  }, [feature, nativo, status?.ativa, status?.plano]);

  const padrao = planos.find((p) => p.id === 'premium')?.id ?? planos[0]?.id ?? 'premium';
  const [escolhido, setEscolhido] = useState<PlanoPlay | null>(null);
  const plano = escolhido && planos.some((p) => p.id === escolhido) ? escolhido : padrao;
  const [ciclo, setCiclo] = useState<IntervaloPlay>('mensal');
  const [erroWeb, setErroWeb] = useState('');
  const [indoWeb, setIndoWeb] = useState(false);

  const display = planos.find((p) => p.id === plano);
  const cor = COR[plano];
  const idx = Math.max(0, planos.findIndex((p) => p.id === plano));
  const temPlanoPago = planoAtual !== 'gratis' && planoAtual !== 'inativo';

  // ── Preços: do Google no app, da tabela no site ─────────────────────────
  const oferta = useMemo(() => {
    const info = PLANOS_INFO[plano];
    if (nativo) {
      const m = precos[produtoPlay(plano, 'mensal')];
      const a = precos[produtoPlay(plano, 'anual')];
      if (m || a) {
        const vm = m ? Number(m.price.value) : NaN;
        const va = a ? Number(a.price.value) : NaN;
        const economia = Number.isFinite(vm) && Number.isFinite(va) && vm > 0 ? Math.round((1 - va / (vm * 12)) * 100) : null;
        return {
          mensal: precoTexto(m),
          anualTotal: precoTexto(a),
          anualMes: precoTexto(a, 12),
          economia: economia && economia > 0 ? economia : null,
          referencia: false,
        };
      }
      // ⚠️ O Google não devolveu o preço: cai no preço de TABELA (o mesmo
      // cadastrado na Play) em vez de travar a venda. A janela do Google mostra
      // o valor final antes de a pessoa confirmar — por isso o rodapé avisa.
      return {
        mensal: fmtBRL(info.mensal),
        anualTotal: fmtBRL(info.totalAnual),
        anualMes: fmtBRL(info.anual),
        economia: info.descAnual,
        referencia: true,
      };
    }
    return { mensal: fmtBRL(info.mensal), anualTotal: null, anualMes: fmtBRL(info.anual), economia: info.descAnual, referencia: false };
  }, [nativo, precos, plano]);

  const temPrecoGoogle = Object.keys(precos).length > 0;
  const carregandoPreco = nativo && (disponivel === null || (disponivel === true && !temPrecoGoogle && !erroPreco));
  const appSemCobranca = nativo && disponivel === false;

  // No celular o paywall é uma TELA, não um card: cobre a página inteira, por
  // cima da barra de baixo. Trava a rolagem do fundo enquanto está aberto.
  useEffect(() => {
    if (!celular) return;
    const html = document.documentElement;
    const antes = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => { html.style.overflow = antes; };
  }, [celular]);
  const ocupado = !!comprando || indoWeb;

  function sair() {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/dashboard');
  }

  async function assinar() {
    if (ocupado || !display) return;
    if (nativo) {
      await compra.assinar(plano, ciclo);
      return; // liberou → o plano muda no AuthContext e a aba abre sozinha
    }
    setErroWeb('');
    setIndoWeb(true);
    try {
      const info = PLANOS_INFO[plano];
      const valor = ciclo === 'anual' ? info.anual : info.mensal;
      trackAddToCart({ name: `Plano ${plano}`, value: valor, currency: 'BRL' });
      trackInitiateCheckout({ name: `Plano ${plano}`, value: valor, currency: 'BRL' });
      const r = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plano, intervalo: ciclo }),
      });
      const j = await r.json().catch(() => ({})) as { url?: string; erro?: string };
      if (j.url) { window.location.href = j.url; return; }
      setErroWeb(j.erro || 'Não foi possível abrir o pagamento. Tente de novo.');
    } catch {
      setErroWeb('Sem conexão com o pagamento agora. Tente de novo em instantes.');
    }
    setIndoWeb(false);
  }

  if (!display) return null;

  const rotuloCta = ocupado
    ? (nativo ? 'Abrindo o pagamento…' : 'Indo para o pagamento…')
    : `Assinar o ${display.nome}${ciclo === 'anual' ? ' anual' : ''}`;

  const tela = (
    <section
      className={`relative isolate mx-auto w-full overflow-hidden text-[#E9FFF2] ${celular ? 'min-h-full' : 'max-w-5xl rounded-[2rem]'}`}
      style={{
        background: 'linear-gradient(180deg, #0B3A35 0%, #072B28 38%, #051C1B 100%)',
        ...(celular ? { paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' } : null),
      }}
      aria-labelledby="paywall-titulo"
    >
      {/* Luz entrando na água: dois focos suaves, nada animado. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60% 38% at 50% -6%, rgba(160,255,210,.20) 0%, transparent 70%),'
            + 'radial-gradient(40% 30% at 85% 22%, rgba(97,206,112,.10) 0%, transparent 70%),'
            + 'radial-gradient(45% 35% at 10% 40%, rgba(56,189,248,.08) 0%, transparent 70%)',
        }} />

      <div className="lg:grid lg:grid-cols-[1.05fr_1fr] lg:gap-6 lg:p-8">
        {/* ── Coluna da história ───────────────────────────────────────── */}
        <div className="relative">
          <div className="flex items-center justify-between px-5 pt-5 lg:px-0 lg:pt-0">
            <span className="flex items-center gap-2 text-sm font-semibold text-white/85">
              <img src="/sora-icon.png" alt="" width={28} height={28} className="h-7 w-7 rounded-lg" />
              Sora
            </span>
            <button type="button" onClick={sair} aria-label="Fechar e continuar no modo grátis"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.08] text-white/80 transition hover:bg-white/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
              <X size={20} />
            </button>
          </div>

          <div className="px-6 pt-4 text-center lg:px-0 lg:pt-8 lg:text-left">
            <h1 id="paywall-titulo"
              className="mx-auto max-w-[18ch] text-[clamp(1.85rem,7.4vw,2.75rem)] font-extrabold leading-[1.04] tracking-[-0.035em] text-white lg:mx-0">
              {chamada}
            </h1>
            <p className="mx-auto mt-3 max-w-[38ch] text-[15px] leading-relaxed text-[#9CC4BA] lg:mx-0">{texto}</p>
          </div>

          <p className="sr-only">Prévia do app: gastos por categoria, saldo previsto do mês e {DESCRICAO_CENTRO[telaDoCentro(feature)]}.</p>
          {/* Os celulares mergulham no fundo, em vez de serem cortados. ⚠️ É
              MÁSCARA, não uma camada de cor por cima: o fundo é degradê, e
              uma faixa de cor fixa aparecia como um retângulo no desktop. */}
          <div className="relative mt-6 lg:mt-10"
            style={{
              maskImage: 'linear-gradient(180deg, #000 62%, transparent 97%)',
              WebkitMaskImage: 'linear-gradient(180deg, #000 62%, transparent 97%)',
            }}>
            <Celulares centro={telaDoCentro(feature)} />
          </div>
        </div>

        {/* ── Coluna da decisão ────────────────────────────────────────── */}
        <div className="relative z-30 -mt-[44vw] px-3 pb-4 sm:-mt-36 lg:mt-0 lg:px-0 lg:pb-0">
          <div className="rounded-[1.75rem] border border-white/[0.09] p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,.8)] backdrop-blur-xl sm:p-6"
            style={{ background: 'rgba(9,38,35,.78)' }}>

            {/* Escolha do plano */}
            {planos.length > 1 ? (
              <div className="relative mt-3">
                <div role="radiogroup" aria-label="Plano" className="relative grid rounded-full bg-black/25 p-1"
                  style={{ gridTemplateColumns: `repeat(${planos.length}, minmax(0, 1fr))` }}>
                  <span aria-hidden className="absolute bottom-1 top-1 rounded-full transition-[transform,background-color] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
                    style={{ left: 4, width: `calc((100% - 8px) / ${planos.length})`, transform: `translateX(${idx * 100}%)`, background: cor.base }} />
                  {planos.map((p) => {
                    const ativo = p.id === plano;
                    return (
                      <button key={p.id} type="button" role="radio" aria-checked={ativo} onClick={() => setEscolhido(p.id)}
                        className="relative z-10 h-11 rounded-full text-[15px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                        style={{ color: ativo ? COR[p.id].texto : 'rgba(233,255,242,.72)' }}>
                        {p.nome}
                      </button>
                    );
                  })}
                </div>
                {planos.some((p) => p.id === 'premium') && (
                  <span className="pointer-events-none absolute -top-3 rounded-full px-2.5 py-0.5 text-[11px] font-bold text-[#06200F] shadow-md"
                    style={{
                      left: `calc(${((planos.findIndex((p) => p.id === 'premium') + 0.5) / planos.length) * 100}% )`,
                      transform: 'translateX(-50%)',
                      background: COR.premium.base,
                    }}>
                    Mais popular
                  </span>
                )}
              </div>
            ) : (
              <p className="text-center text-sm font-semibold" style={{ color: cor.base }}>Plano {display.nome}</p>
            )}

            <h2 className="mt-6 text-[1.35rem] font-bold tracking-[-0.02em] text-white">Como você prefere pagar</h2>
            <p className="mt-1 text-sm text-[#9CC4BA]">{display.subtitulo}</p>

            {/* Mensal × anual */}
            <div role="radiogroup" aria-label="Ciclo de cobrança" className="mt-4 space-y-3">
              {(['mensal', 'anual'] as const).map((c) => {
                const ativo = c === ciclo;
                const principal = c === 'mensal' ? oferta.mensal : (oferta.anualTotal ?? oferta.anualMes);
                const sufixo = c === 'mensal' ? '/ mês' : oferta.anualTotal ? '/ ano' : '/ mês, no plano anual';
                return (
                  <button key={c} type="button" role="radio" aria-checked={ativo} onClick={() => setCiclo(c)}
                    className="relative flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                    style={{
                      borderColor: ativo ? cor.base : 'rgba(255,255,255,.10)',
                      background: ativo ? `color-mix(in srgb, ${cor.base} 13%, transparent)` : 'rgba(255,255,255,.03)',
                    }}>
                    <span aria-hidden className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2"
                      style={{ borderColor: ativo ? cor.base : 'rgba(255,255,255,.35)' }}>
                      {ativo && <span className="h-3 w-3 rounded-full" style={{ background: cor.base }} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[1.05rem] font-bold text-white">{c === 'mensal' ? 'Mensal' : 'Anual'}</span>
                      <span className="mt-0.5 block text-sm text-[#9CC4BA] tabular-nums">
                        {carregandoPreco ? <span className="inline-block h-3.5 w-28 animate-pulse rounded bg-white/10 align-middle" /> : principal ? `${principal} ${sufixo}` : 'Indisponível no momento'}
                      </span>
                    </span>
                    {c === 'anual' && oferta.anualTotal && oferta.anualMes && (
                      <span className="text-right text-sm text-[#9CC4BA] tabular-nums">
                        <span className="block font-semibold text-white">{oferta.anualMes}</span>por mês
                      </span>
                    )}
                    {c === 'anual' && oferta.economia ? (
                      <span className="absolute -top-2.5 right-4 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                        style={{ background: cor.base, color: cor.texto }}>
                        Economize {oferta.economia}%
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Ação */}
            {appSemCobranca ? (
              <a href={LINK_PLAY_STORE}
                className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl text-base font-bold transition active:scale-[0.99]"
                style={{ background: `linear-gradient(135deg, ${cor.base}, ${cor.escura})`, color: cor.texto }}>
                Atualize o app para assinar
              </a>
            ) : (
              <button type="button" onClick={assinar} disabled={ocupado || carregandoPreco}
                className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold shadow-[0_14px_30px_-12px_rgba(97,206,112,.55)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 motion-reduce:transition-none"
                style={{ background: `linear-gradient(135deg, ${cor.base}, ${cor.escura})`, color: cor.texto }}>
                {ocupado && <Loader2 size={18} className="animate-spin" aria-hidden />}
                {rotuloCta}
              </button>
            )}

            {(aviso || erroWeb) && (
              <div role={aviso?.tipo === 'ok' ? 'status' : 'alert'}
                className="mt-4 flex items-start gap-2.5 rounded-2xl border px-3.5 py-3 text-sm leading-relaxed"
                style={{
                  borderColor: aviso?.tipo === 'ok' ? 'rgba(97,206,112,.45)' : aviso?.tipo === 'pendente' ? 'rgba(245,181,68,.45)' : 'rgba(248,113,113,.45)',
                  background: aviso?.tipo === 'ok' ? 'rgba(97,206,112,.10)' : aviso?.tipo === 'pendente' ? 'rgba(245,181,68,.10)' : 'rgba(248,113,113,.10)',
                }}>
                {aviso?.tipo === 'ok'
                  ? <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0 text-[#61CE70]" aria-hidden />
                  : <AlertCircle size={18} className="mt-0.5 flex-shrink-0 text-[#F5B544]" aria-hidden />}
                <div className="flex-1">
                  <p>{aviso?.texto ?? erroWeb}</p>
                  {aviso?.tipo === 'pendente' && (
                    <button type="button" onClick={() => compra.confirmarPendente()} className="mt-1.5 inline-flex min-h-11 items-center gap-1.5 font-semibold underline">
                      <RefreshCw size={14} aria-hidden /> Confirmar compra
                    </button>
                  )}
                </div>
              </div>
            )}

            <p className="mt-4 text-center text-xs leading-relaxed text-[#9CC4BA]/85">
              {nativo
                ? 'Cobrado pela Google Play. Renova sozinho; cancele quando quiser em Play Store › Pagamentos e assinaturas.'
                : 'Pagamento seguro. Renova sozinho e você cancela quando quiser.'}
              {nativo && oferta.referencia && !appSemCobranca && ' O valor final aparece na janela do Google antes de você confirmar.'}
            </p>
            {/* Detalhe técnico: só aparece quando a conversa com o Google falhou,
                pra o print do cliente já dizer o motivo. */}
            {nativo && (erroPreco || (appSemCobranca && motivoIndisponivel)) && (
              <p className="mt-1 text-center text-[11px] leading-snug text-white/35 break-words">
                Detalhe técnico: {appSemCobranca ? motivoIndisponivel : erroPreco}
              </p>
            )}

            <button type="button" onClick={sair}
              className="mx-auto mt-2 flex min-h-11 items-center justify-center whitespace-nowrap rounded-full px-2 text-[13px] font-semibold text-white/70 min-[380px]:text-sm transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
              {temPlanoPago ? 'Agora não' : 'Continuar com o modo manual (grátis)'}
            </button>

            {nativo && !appSemCobranca && (
              <button type="button" onClick={() => compra.confirmarPendente()}
                className="mx-auto flex min-h-11 items-center text-xs text-white/45 underline decoration-white/25 underline-offset-2 hover:text-white/70">
                Já assinei e o plano não apareceu
              </button>
            )}
          </div>

          {/* O que destrava */}
          <div className="mt-4 rounded-[1.75rem] border border-white/[0.07] p-5 sm:p-6" style={{ background: 'rgba(255,255,255,.035)' }}>
            <h2 className="text-lg font-bold tracking-[-0.02em] text-white">O que o {display.nome} destrava</h2>
            <ul className="mt-4 space-y-3.5">
              {DESTRAVA[plano].map((d) => (
                <li key={d.forte} className="flex items-start gap-3 text-[15px] leading-snug text-[#9CC4BA]">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ background: `color-mix(in srgb, ${cor.base} 20%, transparent)` }} aria-hidden>
                    <Check size={13} strokeWidth={3} style={{ color: cor.base }} />
                  </span>
                  <span><span className="font-semibold text-white">{d.forte}</span>{d.resto}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 border-t border-white/[0.07] pt-5">
              <p className="text-sm font-semibold text-white">Conecte os bancos que você já usa</p>
              {/* ⚠️ flex-wrap: em tela estreita o texto desce pra linha de baixo
                  inteiro, em vez de ser cortado na borda do card. */}
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="flex items-center">
                  {BANCOS.map((b, i) => (
                    <img key={b} src={`/brands/${b}.png`} alt="" width={40} height={40}
                      className="h-10 w-10 rounded-full border-2 bg-white object-cover"
                      style={{ borderColor: '#072B28', marginLeft: i === 0 ? 0 : -10, zIndex: BANCOS.length - i }} />
                  ))}
                </span>
                <span className="whitespace-nowrap text-sm text-[#9CC4BA]">e muitos outros</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  // ⚠️ No celular vai por PORTAL pro <body>: o painel tem ancestrais com
  // transform/backdrop-filter, e um `fixed` dentro deles fica preso no card em
  // vez de cobrir a tela (regra "Modal via portal" do CLAUDE.md). z-50 passa
  // por cima da barra de baixo (z-40) e do "+".
  if (celular) {
    return createPortal(
      <div role="dialog" aria-modal="true" aria-labelledby="paywall-titulo"
        className="fixed inset-0 z-50 overflow-y-auto overscroll-contain" style={{ background: '#051C1B' }}>
        {tela}
      </div>,
      document.body,
    );
  }
  return tela;
}

/**
 * Celular = tela abaixo de 768px (o `md` do Tailwind, onde a sidebar aparece).
 * Começa `false` no servidor; o primeiro render no cliente já lê a medida real.
 */
const MQ_CELULAR = '(max-width: 767px)';
function useCelular() {
  return useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia(MQ_CELULAR);
      mq.addEventListener('change', avisar);
      return () => mq.removeEventListener('change', avisar);
    },
    () => window.matchMedia(MQ_CELULAR).matches,
    () => false,
  );
}
