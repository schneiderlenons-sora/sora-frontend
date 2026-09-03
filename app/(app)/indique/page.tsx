'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
  Share2, Copy, Check, Users, Gift, Loader2, Ticket, Sparkles, ArrowRight,
} from 'lucide-react';

// =============================================================================
// Indique e ganhe.
//
// Cada amigo que ASSINA vale 1 mês grátis, até 3. O mês chega como crédito na
// assinatura (Stripe) — ver `lib/indicacoes.ts` pra o porquê de não ser um
// campo no banco.
//
// ⚠️ VITALÍCIO NÃO PARTICIPA, e a tela DIZ ISSO em vez de esconder o botão.
// Ele não tem mensalidade onde descontar um mês; sumir com a aba deixaria a
// pessoa procurando o que não existe. Em vez disso, ela explica e manda pro
// programa de Afiliado, onde ele ganha dinheiro — regra `empty-nav-state` da
// ui-ux-pro-max: destino indisponível se EXPLICA, não se esconde.
// =============================================================================

const BRAND = 'hsl(var(--primary))';
const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function IndiquePage() {
  const { data, isLoading, mutate } = useSWR('/api/indicacoes', fetcher);
  const [copiado, setCopiado] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 2000);
    return () => clearTimeout(t);
  }, [copiado]);

  const max = data?.max ?? 3;
  const total = data?.total ?? 0;
  const pct = Math.min(100, (total / max) * 100);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(data.codigoFormatado);
      setCopiado(true);
    } catch { /* clipboard bloqueado: o código está na tela pra copiar à mão */ }
  }

  async function compartilhar() {
    const texto = `Uso a Sora pra organizar minhas finanças pelo WhatsApp. Usa meu código ${data.codigoFormatado} quando assinar: https://www.forsora.com`;
    // `navigator.share` só existe em contexto seguro e em parte dos browsers —
    // sem ele, copiar é o caminho que sempre funciona.
    if (navigator.share) { try { await navigator.share({ text: texto }); return; } catch { return; } }
    try { await navigator.clipboard.writeText(texto); setCopiado(true); } catch {}
  }

  async function usar() {
    setEnviando(true); setErro(''); setSucesso('');
    try {
      const r = await fetch('/api/indicacoes/usar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || 'Não consegui usar o código.');
      setSucesso(j.aviso || `Pronto! ${j.indicador} ganhou um mês grátis 🎉`);
      setCodigo('');
      mutate();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui usar o código.');
    } finally { setEnviando(false); }
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 pb-24 pt-2 space-y-4 animate-pulse">
        <div className="h-44 rounded-3xl bg-muted/40" />
        <div className="h-24 rounded-3xl bg-muted/40" />
        <div className="h-40 rounded-3xl bg-muted/40" />
      </div>
    );
  }

  // ── Vitalício / sem assinatura: explica e oferece a saída ────────────────
  if (data?.bloqueioIndicar) {
    const ehVitalicio = data.bloqueioIndicar === 'vitalicio';
    return (
      <div className="max-w-2xl mx-auto px-4 pb-24 pt-2">
        <Cabecalho />
        <div className="rounded-3xl border border-border/60 p-6 text-center"
             style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
          <span className="grid place-items-center w-14 h-14 rounded-2xl mx-auto mb-4"
                style={{ background: `color-mix(in srgb, ${BRAND} 13%, transparent)` }}>
            <Sparkles size={24} style={{ color: BRAND }} />
          </span>
          <h2 className="text-lg font-bold text-foreground">
            {ehVitalicio ? 'Você já tem a Sora pra sempre' : 'Disponível pra quem assina'}
          </h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            {ehVitalicio
              ? 'O prêmio do Indique e ganhe é um mês de mensalidade — e você não paga mensalidade. Em vez de um mês, dá pra você ganhar dinheiro de verdade indicando: é o programa de Afiliado.'
              : 'O Indique e ganhe dá um mês grátis por amigo que assina. Como ele é aplicado na sua mensalidade, ele começa a valer quando você tiver uma assinatura ativa.'}
          </p>
          <Link href={ehVitalicio ? '/afiliados' : '/planos'}
                className="mt-5 inline-flex items-center gap-2 px-5 rounded-2xl text-white text-sm font-bold"
                style={{ background: BRAND, minHeight: 48 }}>
            {ehVitalicio ? 'Conhecer o programa de Afiliado' : 'Ver planos'}
            <ArrowRight size={16} />
          </Link>
        </div>
        <ComoFunciona max={max} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pb-24 pt-2 space-y-4">
      <Cabecalho />

      {/* ── O código ───────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-border/60 p-6 text-center"
           style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Seu código</p>
        {/* `tabular` + tracking largo: o código é lido em voz alta e digitado à
            mão, então cada caractere precisa ser distinguível. */}
        <p className="text-4xl font-black text-foreground mt-2 tabular" style={{ letterSpacing: '0.08em' }}>
          {data?.codigoFormatado || '—'}
        </p>
        <div className="flex items-center gap-2.5 mt-5">
          <button onClick={copiar}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl text-white text-sm font-bold active:scale-[0.98] transition-transform"
            style={{ background: BRAND, minHeight: 48 }}>
            {copiado ? <><Check size={16} /> Copiado</> : <><Copy size={16} /> Copiar</>}
          </button>
          <button onClick={compartilhar}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl text-white text-sm font-bold active:scale-[0.98] transition-transform"
            style={{ background: BRAND, minHeight: 48 }}>
            <Share2 size={16} /> Compartilhar
          </button>
        </div>
      </div>

      {/* ── Progresso ──────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-border/60 p-5" style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full transition-[width] duration-500"
               style={{ width: `${pct}%`, background: BRAND }} />
        </div>
        <p className="text-base font-bold text-foreground mt-3">
          {total} de {max} amigos assinantes
        </p>
        <p className="text-sm text-muted-foreground">
          {data?.creditadas ?? 0} {(data?.creditadas ?? 0) === 1 ? 'mês creditado' : 'meses creditados'}
        </p>
      </div>

      {/* ── Usar um código ─────────────────────────────────────────────── */}
      {!data?.jaUsouCodigo && (
        <div className="rounded-3xl border border-border/60 p-5 space-y-3" style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
          <h3 className="text-base font-bold text-foreground">Tem um código de convite?</h3>
          {data?.bloqueioUsar ? (
            // ⚠️ Diz POR QUE não dá, em vez de mostrar um campo que vai recusar.
            <p className="text-sm text-muted-foreground leading-relaxed">{data.bloqueioUsar}</p>
          ) : (
            <>
              <input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                placeholder="EX: VINI-3F2K"
                aria-label="Código de convite"
                className="input w-full text-center tabular text-lg"
                style={{ minHeight: 52, letterSpacing: '0.06em' }}
                autoCapitalize="characters" autoComplete="off" spellCheck={false}
              />
              <button
                onClick={usar}
                disabled={enviando || codigo.replace(/[^A-Z0-9]/g, '').length < 6}
                className="w-full flex items-center justify-center gap-2 rounded-2xl text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
                style={{ background: BRAND, minHeight: 48 }}>
                {enviando ? <><Loader2 size={16} className="animate-spin" /> Validando…</> : 'Usar código'}
              </button>
              {erro && <p className="text-[13px] text-red-600 dark:text-red-400 leading-snug">{erro}</p>}
              {sucesso && <p className="text-[13px] font-semibold leading-snug" style={{ color: BRAND }}>{sucesso}</p>}
            </>
          )}
        </div>
      )}

      <ComoFunciona max={max} />

      {/* ── Quem já usou ───────────────────────────────────────────────── */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 mb-2">
          Seus convites
        </p>
        <div className="rounded-3xl border border-border/60 overflow-hidden" style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
          {(data?.indicacoes || []).length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground leading-relaxed">
              Ninguém usou seu código ainda. Compartilha com quem vive no vermelho 👀
            </p>
          ) : (
            data.indicacoes.map((i: any, n: number) => (
              <div key={i.id}
                   className={`flex items-center justify-between gap-3 px-4 py-3.5 ${n ? 'border-t border-border/50' : ''}`}>
                <span className="flex items-center gap-2.5 min-w-0">
                  <Users size={15} className="text-muted-foreground flex-shrink-0" />
                  <span className="text-sm text-foreground truncate">{i.indicado?.name || 'Amigo'}</span>
                </span>
                {/* Status por ÍCONE + RÓTULO, nunca só cor (`color-not-only`). */}
                <span className="text-[12px] font-semibold flex items-center gap-1.5 flex-shrink-0"
                      style={{ color: i.status === 'creditado' ? BRAND : 'hsl(var(--muted-foreground))' }}>
                  {i.status === 'creditado' ? <><Gift size={13} /> Mês creditado</> : <><Loader2 size={13} /> Processando</>}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Cabecalho() {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="grid place-items-center w-11 h-11 rounded-2xl flex-shrink-0"
            style={{ background: `color-mix(in srgb, ${BRAND} 13%, transparent)` }}>
        <Ticket size={20} style={{ color: BRAND }} />
      </span>
      <div>
        <h1 className="text-2xl font-black text-foreground leading-tight">Indique e ganhe</h1>
        <p className="text-sm text-muted-foreground">Um mês grátis por amigo que assinar.</p>
      </div>
    </div>
  );
}

function ComoFunciona({ max }: { max: number }) {
  return (
    <div className="rounded-3xl border border-border/60 p-5" style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
      <h3 className="text-base font-bold text-foreground mb-2">Como funciona</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Toca em <strong className="text-foreground">Compartilhar</strong> e manda o código pro seu amigo.
        Ele cria a conta e cola o código aqui em <strong className="text-foreground">Indique e ganhe</strong>,
        em até 7 dias depois de criar a conta.
      </p>
      <p className="text-sm text-muted-foreground leading-relaxed mt-3">
        {/* Esta é a regra que mais gera dúvida — por isso vem destacada. */}
        <strong className="text-foreground">O mês grátis nasce quando ele ASSINA</strong>, não no cadastro:
      </p>
      <ul className="text-sm text-muted-foreground leading-relaxed mt-1.5 space-y-1">
        <li>• Cada amigo que assina = 1 mês grátis, como crédito na sua assinatura</li>
        <li>• Dá pra acumular até {max} meses</li>
      </ul>
      <p className="text-sm text-muted-foreground leading-relaxed mt-3">
        Use o seu e-mail principal: contas com &quot;+&quot; no endereço (tipo voce+1@gmail.com) não valem.
      </p>
    </div>
  );
}
