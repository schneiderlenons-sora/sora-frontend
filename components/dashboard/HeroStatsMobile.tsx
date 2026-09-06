'use client';

import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  fatiasDeContas, saldoPorContaDe, acumuladoDe,
  IconesContas, BarraContas, Sparkline, type Conta,
} from '@/components/dashboard/stat-visuais';

// =============================================================================
// Stats do hero — versão MOBILE (2 cards por linha).
//
// Substituem os 3 chips espremidos em `grid-cols-3` que existiam antes: com 3
// colunas num celular de 375px cada chip ficava com ~105px e TODO valor era
// truncado, o que já tinha gerado a regra do CLAUDE.md de "mini-card de stat
// que trunca = sempre expansível". Com 2 colunas o valor cabe inteiro.
//
// LAYOUT:
//   Linha 1 (ALTA)  → Saldo em contas · Gastos do mês
//   Linha 2 (BAIXA) → VS mês anterior · Maior gasto
// A diferença de altura é intencional: os dois de cima carregam ícones, barra
// e gráfico; os de baixo são frases curtas e ficam finos pra não sobrar vazio.
//
// ⚠️ ESTES QUATRO SÃO OS ÚNICOS STATS DO MOBILE. O `ResumoCards` abaixo do
// hábitos já não repete Saldo nem Gastos no celular — por isso a expansão
// daqui tem de entregar o MESMO detalhe que a de lá entregava (saldo de cada
// conta e gasto de cada conta). Encolher esses painéis é perder informação que
// o usuário tinha, não simplificar.
//
// DECISÕES QUE NÃO PODEM REGREDIR:
// · Ícones, barra e sparkline vêm de `stat-visuais.tsx` — os MESMOS que o
//   desktop usa no `ResumoCards`. Não recriar aqui.
// · Altura FIXA no gráfico e na barra → sem CLS quando o dado chega.
// · Continuam sendo BOTÕES que expandem o valor completo abaixo (regra do
//   CLAUDE.md), e o painel abre logo após a LINHA do card tocado — via
//   `order`, mesmo truque do ResumoCards. Painel no fim de tudo faz o usuário
//   não perceber que expandiu.
// · Cor "cítrica" pedida pelo usuário: lime-600 no claro / lime-400 no escuro.
//   Não é o mesmo tom nos dois temas de propósito — lime claro sobre fundo
//   branco fica em ~1.7:1 e some (regra de contraste de dado, ≥3:1).
// =============================================================================

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface Props {
  contas: Conta[];
  saldoTotal: number;
  gastosMes: number;
  /** Gasto por dia do mês (não acumulado) — vira linha acumulada no sparkline. */
  dadosDiarios: { dia: string; valor: number }[];
  /** Gasto do mês por conta — o detalhe que o card "Gastos do mês" abre. */
  gastoPorConta: { nome: string; total: number }[];
  monthName: string;
  monthNameAnt: string;
  varGastos: number;
  gastosAnt: number;
  maiorCat: { categoria: string; total: number } | null;
  totalGastos: number;
}

type Aberto = 'saldo' | 'gastos' | 'vs' | 'maior' | null;

function parseCategoria(cat: string) {
  const parts = (cat || '').split(' ');
  const hasEmoji = /\p{Emoji}/u.test(parts[0] || '');
  return { emoji: hasEmoji ? parts[0] : '📦', nome: hasEmoji ? parts.slice(1).join(' ') : cat };
}

export default function HeroStatsMobile({
  contas, saldoTotal, gastosMes, dadosDiarios, gastoPorConta, monthName, monthNameAnt,
  varGastos, gastosAnt, maiorCat, totalGastos,
}: Props) {
  const [aberto, setAberto] = useState<Aberto>(null);
  const toggle = (k: Exclude<Aberto, null>) => setAberto((p) => (p === k ? null : k));

  const fatias = useMemo(() => fatiasDeContas(contas), [contas]);
  const acumulado = useMemo(() => acumuladoDe(dadosDiarios), [dadosDiarios]);

  // Lista do painel do saldo: TODAS as contas, não só as que compõem a barra.
  // A cor do ponto só existe pra quem está na barra; conta zerada ou negativa
  // ganha ponto neutro — e o valor negativo vai em vermelho, porque a cor
  // sozinha não pode carregar o significado (vem com o sinal no número).
  const linhasSaldo = useMemo(() => {
    const cor = new Map(fatias.map((f) => [f.nome, f.cor]));
    return saldoPorContaDe(contas).map((c) => ({ ...c, cor: cor.get(c.nome) || null }));
  }, [contas, fatias]);

  const nContas = contas.length;

  return (
    <div className="grid grid-cols-2 gap-2.5 md:hidden">

      {/* ══ Linha 1 · Saldo em contas ══════════════════════════════════ */}
      <CardBase
        aberto={aberto === 'saldo'}
        onToggle={() => toggle('saldo')}
        label="Saldo em contas"
        aria={`Saldo em contas: ${fmt(saldoTotal)}, ${nContas} conta${nContas === 1 ? '' : 's'}`}
        className="order-1"
        topo={<span className="block mb-2.5"><IconesContas contas={contas} /></span>}
      >
        <span className="block text-[19px] font-bold text-foreground tabular tracking-tight leading-none truncate">
          {fmt(saldoTotal)}
        </span>

        <BarraContas fatias={fatias} className="mt-2.5" />

        <span className="block mt-2 text-[11px] text-muted-foreground leading-tight">
          {nContas === 0
            ? 'Nenhuma conta ainda'
            : `${nContas} conta${nContas === 1 ? '' : 's'} conectada${nContas === 1 ? '' : 's'}`}
        </span>
      </CardBase>

      {/* ══ Linha 1 · Gastos do mês ════════════════════════════════════ */}
      <CardBase
        aberto={aberto === 'gastos'}
        onToggle={() => toggle('gastos')}
        label="Gastos do mês"
        aria={`Gastos do mês: ${fmt(gastosMes)}`}
        className="order-2"
        topo={
          /* Mesma altura do bloco de ícones do card ao lado (h-8) + o respiro,
             pra os dois rótulos ficarem na MESMA linha de base. Reservada mesmo
             sem dado → o card não muda de tamanho quando o gráfico chega. */
          <span className="block h-8 mb-2.5">
            <Sparkline valores={acumulado} />
          </span>
        }
      >
        <span className="block text-[19px] font-bold text-foreground tabular tracking-tight leading-none truncate">
          {fmt(gastosMes)}
        </span>
        <span className="block mt-2 text-[11px] text-muted-foreground leading-tight capitalize">
          {monthName}
        </span>
      </CardBase>

      {/* Painel da linha 1 — order-3 o coloca logo DEPOIS dela. */}
      {(aberto === 'saldo' || aberto === 'gastos') && (
        <Painel className="order-3">
          {aberto === 'saldo' ? (
            <>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">
                Saldo por conta
              </p>
              {linhasSaldo.length ? (
                <ul className="divide-y divide-border/50">
                  {linhasSaldo.map((c) => (
                    <li key={c.nome} className="flex items-center gap-2 text-sm py-2 first:pt-0 last:pb-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: c.cor || 'hsl(var(--muted-foreground) / 0.35)' }} />
                      <span className="text-foreground truncate flex-1">{c.nome}</span>
                      <span className={`tabular font-semibold flex-shrink-0 ${
                        (c.saldo ?? 0) < 0 ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground'
                      }`}>
                        {/* ⚠️ Sem câmbio a conta NÃO vira R$ 0,00 nem repete o
                            valor nativo com "R$": as duas coisas mentem sobre
                            quanto a pessoa tem. Mesma frase da aba de contas. */}
                        {c.saldo === null ? (
                          <span className="text-[11px] font-normal">câmbio indisponível</span>
                        ) : fmt(c.saldo)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">Sem contas cadastradas.</p>
              )}
            </>
          ) : (
            <>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">
                Gastos por conta · <span className="capitalize">{monthName}</span>
              </p>
              {gastoPorConta.length ? (
                <ul className="divide-y divide-border/50">
                  {gastoPorConta.map((c) => (
                    <li key={c.nome} className="flex items-center gap-2 text-sm py-2 first:pt-0 last:pb-0">
                      <span className="text-foreground truncate flex-1">{c.nome}</span>
                      <span className="tabular font-semibold text-red-500 dark:text-red-400 flex-shrink-0">
                        {fmt(c.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">Nenhum gasto em {monthName} ainda.</p>
              )}
            </>
          )}
        </Painel>
      )}

      {/* ══ Linha 2 · VS mês anterior (fino) ═══════════════════════════ */}
      <CardBase
        compacto
        aberto={aberto === 'vs'}
        onToggle={() => toggle('vs')}
        label="VS mês anterior"
        aria={`Comparado ao mês anterior: ${gastosAnt ? `${varGastos}%` : 'sem dados'}`}
        className="order-4"
      >
        {/* 14px (não 19px como os cards altos): stat secundário. A hierarquia
            fica 19 → 14 → 10, e "Facebook Ads" no card ao lado só cabe inteiro
            nesse tamanho — os dois iguais pra a linha não ficar desalinhada. */}
        <span className={`block text-[14px] font-bold tabular tracking-tight leading-none truncate ${
          !gastosAnt ? 'text-muted-foreground'
            : varGastos > 0 ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'
        }`}>
          {gastosAnt ? `${varGastos > 0 ? '+' : ''}${varGastos}%` : '—'}
        </span>
      </CardBase>

      {/* ══ Linha 2 · Maior gasto (fino) ═══════════════════════════════ */}
      <CardBase
        compacto
        aberto={aberto === 'maior'}
        onToggle={() => toggle('maior')}
        label="Maior gasto"
        aria={`Maior gasto: ${maiorCat ? parseCategoria(maiorCat.categoria).nome : 'nenhum'}`}
        className="order-5"
      >
        <span className="block text-[14px] font-bold text-foreground tracking-tight leading-none truncate">
          {maiorCat ? parseCategoria(maiorCat.categoria).nome : '—'}
        </span>
      </CardBase>

      {/* Painel da linha 2 — order-6, logo depois dela. */}
      {(aberto === 'vs' || aberto === 'maior') && (
        <Painel className="order-6">
          {aberto === 'vs' ? (
            gastosAnt ? (
              <>
                <p className={`font-bold text-2xl tabular tracking-tight ${
                  varGastos > 0 ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                }`}>
                  {(varGastos > 0 ? '+' : '') + varGastos}% {varGastos > 0 ? 'a mais' : varGastos < 0 ? 'a menos' : 'igual'}
                </p>
                <p className="text-muted-foreground text-sm mt-1">
                  De {fmt(gastosAnt)} ({monthNameAnt}) para {fmt(gastosMes)} ({monthName})
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Sem dados de {monthNameAnt} pra comparar ainda.</p>
            )
          ) : maiorCat ? (
            <>
              <p className="text-foreground font-bold text-2xl tracking-tight">
                {parseCategoria(maiorCat.categoria).nome}
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                {fmt(maiorCat.total)}
                {totalGastos ? ` · ${Math.round((maiorCat.total / totalGastos) * 100)}% do total de ${monthName}` : ''}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">Nenhum gasto registrado em {monthName} ainda.</p>
          )}
        </Painel>
      )}
    </div>
  );
}

// ── Casca comum dos 4 cards ──────────────────────────────────────────────
// Botão (não div): o card inteiro expande o valor completo — vale a semântica
// e o foco de teclado que vêm de graça.
function CardBase({
  label, aria, aberto, onToggle, children, topo, className = '', compacto = false,
}: {
  label: string; aria: string; aberto: boolean; onToggle: () => void;
  children: React.ReactNode;
  /** Conteúdo ANTES do rótulo (ícones das contas, sparkline) — é a ordem do
   *  painel de referência: visual no topo, depois rótulo, depois número. */
  topo?: React.ReactNode;
  className?: string; compacto?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={aberto}
      aria-label={`${aria}. Toque para ${aberto ? 'recolher' : 'ver detalhes'}`}
      // ⚠️ No escuro o fundo é PRETO translúcido, não branco a 5%: com o vídeo
      // agora fixo, o card sobe por cima da parte vívida da imagem ao rolar, e
      // um véu branco de 5% deixava texto branco sobre imagem clara —
      // ilegível. Preto + blur devolve o contraste em qualquer frame.
      // O `backdrop-blur-lg` é o que segura a leitura com alfa baixo.
      className={`relative min-w-0 text-center rounded-2xl backdrop-blur-lg border transition-all active:scale-[0.98] ${
        compacto ? 'p-3' : 'p-3.5'
      } ${
        aberto
          ? 'bg-white/85 dark:bg-black/60 border-[#61D17B]/60 ring-1 ring-[#61D17B]/40'
          : 'bg-white/55 dark:bg-black/40 border-border/30 dark:border-white/10'
      } ${className}`}
    >
      {/* ⚠️ Chevron ABSOLUTO no canto, fora do fluxo. Quando ele participava da
          linha, o conteúdo centralizava no espaço que SOBRAVA dele — ficava
          sempre alguns pixels à esquerda do centro real do card. */}
      <ChevronRight
        size={13}
        aria-hidden
        className={`absolute top-2.5 right-2.5 text-muted-foreground/60 transition-transform ${aberto ? 'rotate-90' : ''}`}
      />
      {topo}
      {/* Folga pro chevron SÓ nos cards sem `topo`. Nos altos, o bloco visual
          (ícones/gráfico, h-8) já empurra o rótulo pra baixo da altura do
          chevron — não há colisão, e reservar espaço ali era o que fazia
          "Saldo em contas" sair cortado. Quando precisa, o padding é
          SIMÉTRICO: só à direita resolveria a colisão mas tiraria do centro. */}
      <span className={`block text-muted-foreground/70 dark:text-muted-foreground text-[10px] uppercase tracking-wider font-medium leading-tight truncate mb-1 ${
        topo ? '' : 'px-4'
      }`}>
        {label}
      </span>
      {children}
    </button>
  );
}

// ── Painel de detalhe (full-width dentro do grid) ────────────────────────
function Painel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`col-span-2 rounded-2xl p-4 backdrop-blur-lg bg-white/55 dark:bg-black/40 border border-border/30 dark:border-white/10 animate-fade-in ${className}`}>
      {children}
    </div>
  );
}
