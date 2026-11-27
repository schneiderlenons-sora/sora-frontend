'use client';

// =============================================================================
// Detalhe da fatura → "Compras divididas" (migration 206).
// Quem deve quanto NESTA fatura, calculado em cima das MESMAS compras que o
// detalhe lista (lib/divisao.ts → pessoasDaFatura). Por pessoa:
//   · Cobrar pelo WhatsApp — abre o WhatsApp DO CLIENTE com a mensagem pronta
//     (não passa pela Sora nem custa nada na Meta);
//   · Registrar que a pessoa pagou — direto na fatura (abre o Pagar fatura com
//     a parte separada), mandou o dinheiro pra uma conta (entrada fora das
//     receitas, ou o Pix que já chegou) ou de outro jeito;
//   · Desfazer cada registro.
// Sem a migration 206 o bloco simplesmente não aparece (não há compra dividida).
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import { Users, MessageCircle, Check, X, Loader2, ChevronDown, Landmark, Wallet as WalletIcon, CreditCard, HandCoins } from 'lucide-react';
import { api } from '@/lib/api';
import { useDinheiro, useMoedaBase } from '@/lib/moeda-base';
import { textoDasUnidades, unidadesDoValor, valorDasUnidades } from '@/lib/moeda';
import { pessoasDaFatura, mensagemCobranca, linkWhatsApp, type PessoaDaFatura, type AcertoDivisao } from '@/lib/divisao';
import { useConfirmar, useAvisar } from '@/contexts/ConfirmContext';
import PagarFaturaModal from '@/components/cartoes/PagarFaturaModal';

const FORMA: Record<string, string> = {
  conta: 'mandou pra sua conta',
  vincular: 'Pix ligado',
  fatura: 'pagou direto na fatura',
  registro: 'acertou de outro jeito',
};

export default function DivisoesDaFatura({
  phone, cartao, competencia, rotulo, linhas, contas, restante, onMudou,
}: {
  phone: string;
  cartao: { id: string; nome: string };
  competencia: string;
  /** "dezembro" — vai na mensagem de cobrança. */
  rotulo: string;
  /** As compras que o detalhe da fatura está mostrando. */
  linhas: any[];
  /** Contas (não cartão) pra "mandou o dinheiro pra mim". */
  contas: { id: string; nome: string; tipo?: string; of_conta_id?: string | null }[];
  /** O que falta pagar da fatura (o Pagar fatura abre com ele). */
  restante: number;
  onMudou: () => void;
}) {
  const fmt = useDinheiro();
  const temDivisao = useMemo(() => (linhas || []).some((t) => t?.dividida_com && Number(t.parte_outro) > 0), [linhas]);
  const chaveAcertos = temDivisao && phone ? `d:divisoes-acertos:${cartao.id}:${competencia}` : null;
  const { data, mutate } = useSWR(chaveAcertos, () => api.divisoes.acertos(cartao.id, competencia), { revalidateOnFocus: false });
  const pessoas = useMemo(() => pessoasDaFatura(linhas, data?.acertos ?? []), [linhas, data]);
  const [registrando, setRegistrando] = useState<PessoaDaFatura | null>(null);
  const [pagarParte, setPagarParte] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const confirmar = useConfirmar();
  const avisar = useAvisar();

  if (!temDivisao || !pessoas.length) return null;

  async function desfazer(p: PessoaDaFatura, a: AcertoDivisao) {
    const ok = await confirmar({
      titulo: `Desfazer o pagamento de ${p.nome}?`,
      mensagem: a.forma === 'conta'
        ? `A entrada de ${fmt(a.valor)} que a Sora lançou na sua conta sai, e o saldo volta.`
        : a.forma === 'vincular'
          ? 'O Pix volta a contar como receita, e a parte volta a constar como a receber.'
          : `A parte de ${p.nome} volta a constar como a receber.`,
      confirmar: 'Desfazer', perigo: true,
    });
    if (!ok) return;
    try {
      const r = await api.divisoes.desfazerAcerto(a.id);
      await mutate();
      onMudou();
      if (r.aviso) void avisar({ titulo: 'Desfeito', mensagem: r.aviso });
    } catch (e: any) {
      void avisar({ titulo: 'Não deu pra desfazer', mensagem: e?.message || 'Tente de novo.' });
    }
  }

  return (
    <section aria-label="Compras divididas" className="rounded-2xl border border-border p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Users size={15} className="text-primary" aria-hidden /> Compras divididas</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">O que cada pessoa te deve nesta fatura.</p>
      </div>

      {pessoas.map((p) => {
        const quitada = p.devido > 0 && p.aReceber <= 0.009;
        const texto = mensagemCobranca({ nome: p.nome, cartao: cartao.nome, fatura: rotulo, aReceber: p.aReceber, recebido: p.recebido, compras: p.compras, fmt });
        const expandida = aberta === p.chave;
        return (
          <div key={p.chave} className="rounded-xl bg-muted/30 p-3 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{p.nome}</p>
                <p className="text-[11px] text-muted-foreground">
                  {p.compras.length} {p.compras.length === 1 ? 'compra' : 'compras'} · parte {fmt(p.devido)}
                  {p.recebido > 0.009 && <> · já pagou {fmt(p.recebido)}</>}
                </p>
              </div>
              {quitada ? (
                <span className="text-[11px] font-semibold text-green-700 dark:text-green-400 inline-flex items-center gap-1 flex-shrink-0"><Check size={12} aria-hidden /> Acertado</span>
              ) : (
                <span className="text-right flex-shrink-0">
                  <span className="block text-[10px] text-muted-foreground">Falta</span>
                  <span className="block text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400">{fmt(p.aReceber)}</span>
                </span>
              )}
            </div>

            {p.compras.length > 0 && (
              <button type="button" onClick={() => setAberta(expandida ? null : p.chave)} aria-expanded={expandida}
                className="text-[11px] font-semibold text-muted-foreground inline-flex items-center gap-1 min-h-9">
                <ChevronDown size={12} className={`transition-transform ${expandida ? 'rotate-180' : ''}`} aria-hidden /> {expandida ? 'Esconder as compras' : 'Ver as compras'}
              </button>
            )}
            {expandida && (
              <ul className="space-y-1">
                {p.compras.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-foreground truncate">{c.descricao}{c.parcela && !c.descricao.includes(c.parcela) ? ` (${c.parcela})` : ''}</span>
                    <span className="tabular-nums text-muted-foreground flex-shrink-0">{fmt(c.parte)} de {fmt(c.valor)}</span>
                  </li>
                ))}
              </ul>
            )}

            {p.acertos.length > 0 && (
              <ul className="space-y-1">
                {p.acertos.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-green-700 dark:text-green-400 inline-flex items-center gap-1 min-w-0">
                      <Check size={11} aria-hidden /> <span className="truncate">{fmt(a.valor)} · {FORMA[a.forma] || 'pago'}</span>
                    </span>
                    <button type="button" onClick={() => desfazer(p, a)} className="text-[11px] font-semibold text-muted-foreground hover:text-foreground underline underline-offset-2 min-h-9 flex-shrink-0">
                      Desfazer
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {!quitada && (
              <div className="grid grid-cols-2 gap-2">
                <a href={linkWhatsApp(texto)} target="_blank" rel="noopener noreferrer"
                   className="h-10 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 border border-border bg-card hover:border-primary/50">
                  <MessageCircle size={14} aria-hidden /> Cobrar no WhatsApp
                </a>
                <button type="button" onClick={() => setRegistrando(p)}
                        className="h-10 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 text-white bg-primary">
                  <HandCoins size={14} aria-hidden /> Já pagou
                </button>
              </div>
            )}
          </div>
        );
      })}

      {registrando && (
        <RegistrarAcerto
          pessoa={registrando}
          cartao={cartao}
          competencia={competencia}
          contas={contas}
          onClose={() => setRegistrando(null)}
          onPagarNaFatura={() => { setPagarParte(registrando.nome); setRegistrando(null); }}
          onFeito={async () => { setRegistrando(null); await mutate(); onMudou(); }}
        />
      )}

      {pagarParte && (
        <PagarFaturaModal
          cartaoId={cartao.id}
          cartaoNome={cartao.nome}
          valorFatura={restante}
          competencia={competencia}
          partesDivididas={pessoas.filter((x) => x.aReceber > 0.009).map((x) => ({ pessoa: x.nome, aReceber: x.aReceber }))}
          incluirParteDe={pagarParte}
          onClose={() => setPagarParte(null)}
          onPago={async () => { await mutate(); onMudou(); }}
        />
      )}
    </section>
  );
}

// ── "Fulano já pagou" ────────────────────────────────────────────────────────
function RegistrarAcerto({ pessoa, cartao, competencia, contas, onClose, onPagarNaFatura, onFeito }: {
  pessoa: PessoaDaFatura;
  cartao: { id: string; nome: string };
  competencia: string;
  contas: { id: string; nome: string; tipo?: string; of_conta_id?: string | null }[];
  onClose: () => void;
  onPagarNaFatura: () => void;
  onFeito: () => void;
}) {
  const fmt = useDinheiro();
  const moeda = useMoedaBase();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [valorRaw, setValorRaw] = useState(String(unidadesDoValor(pessoa.aReceber, moeda)));
  const valor = valorDasUnidades(parseInt(valorRaw || '0', 10), moeda);
  const [passo, setPasso] = useState<'como' | 'conta'>('como');
  const [conta, setConta] = useState<{ id: string; nome: string; banco: boolean } | null>(null);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const contasDebito = contas.filter((c) => c.tipo !== 'Crédito');

  const { data: recData, error: recErro } = useSWR(
    conta ? ['divisao-recebimentos', conta.id, valor] : null,
    () => api.divisoes.recebimentos(conta!.id, valor),
    { revalidateOnFocus: false },
  );

  async function registrar(body: { forma: 'conta' | 'vincular' | 'registro'; wallet_id?: string; transacao_id?: string }) {
    setErro('');
    if (!(valor > 0)) { setErro('Informe quanto a pessoa pagou.'); return; }
    setSalvando(true);
    try {
      await api.divisoes.registrarAcerto({ cartao_id: cartao.id, competencia, pessoa: pessoa.nome, valor, ...body });
      onFeito();
    } catch (e: any) {
      setErro(e?.message || 'Não consegui registrar agora. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div role="dialog" aria-modal="true" aria-label={`${pessoa.nome} já pagou`}
           className="relative w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border max-h-[90dvh] flex flex-col animate-fade-in"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground">{pessoa.nome} já pagou</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="w-10 h-10 -mr-2 rounded-xl flex items-center justify-center hover:bg-muted"><X size={18} /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground mb-1.5 block">Quanto pagou</span>
            <input value={textoDasUnidades(valorRaw ? parseInt(valorRaw, 10) : 0, moeda)}
                   onChange={(e) => setValorRaw(e.target.value.replace(/\D/g, ''))}
                   inputMode="numeric" className="input tabular-nums" />
            <span className="block text-[11px] text-muted-foreground mt-1">A parte nesta fatura é {fmt(pessoa.aReceber)}.</span>
          </label>

          {passo === 'como' ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Como pagou?</p>
              <Opcao Icone={CreditCard} titulo="Direto na fatura"
                     texto="Abre o Pagar fatura com a parte separada como paga pela pessoa."
                     onClick={onPagarNaFatura} />
              <Opcao Icone={WalletIcon} titulo="Mandou o dinheiro pra mim"
                     texto="Pix ou transferência pra uma conta sua. Não conta como receita."
                     onClick={() => setPasso('conta')} disabled={!contasDebito.length} />
              <Opcao Icone={HandCoins} titulo="De outro jeito"
                     texto="Dinheiro em mão, acerto de contas… Só fica registrado."
                     onClick={() => registrar({ forma: 'registro' })} disabled={salvando} />
            </div>
          ) : !conta ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Em qual conta o dinheiro entrou?</p>
              {contasDebito.map((c) => (
                <button key={c.id} type="button" onClick={() => setConta({ id: c.id, nome: c.nome, banco: !!c.of_conta_id })}
                        className="w-full min-h-11 px-3 rounded-xl border border-border bg-card hover:border-primary/50 text-left text-sm font-medium text-foreground inline-flex items-center gap-2">
                  {c.of_conta_id ? <Landmark size={14} className="text-muted-foreground" aria-hidden /> : <WalletIcon size={14} className="text-muted-foreground" aria-hidden />} {c.nome}
                </button>
              ))}
              <button type="button" onClick={() => setPasso('como')} className="text-xs font-semibold text-muted-foreground underline underline-offset-2 min-h-9">Voltar</button>
            </div>
          ) : (
            <div className="space-y-3">
              {!conta.banco && (
                <button type="button" onClick={() => registrar({ forma: 'conta', wallet_id: conta.id })} disabled={salvando}
                        className="w-full min-h-11 px-3 py-2.5 rounded-xl text-sm font-bold text-white bg-primary disabled:opacity-60 text-left">
                  Lançar a entrada de {fmt(valor)} em {conta.nome}
                  <span className="block text-[11px] font-normal text-white/85">Entra no saldo, fora das receitas.</span>
                </button>
              )}
              <p className="text-xs font-semibold text-muted-foreground">
                {conta.banco
                  ? `O dinheiro chega sozinho pelo seu banco. Qual destes é o Pix de ${pessoa.nome}?`
                  : 'Ou já lançou essa entrada? Escolha qual:'}
              </p>
              {recErro ? (
                <p className="text-xs text-red-600" role="alert">Não consegui ler as entradas desta conta agora.</p>
              ) : !recData ? (
                <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" aria-hidden /> Procurando as entradas…</p>
              ) : recData.recebimentos.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {conta.banco
                    ? `O Pix de ${pessoa.nome} ainda não apareceu em ${conta.nome}. Quando o banco trouxer, volte aqui e escolha ele.`
                    : 'Nenhuma entrada nos últimos 45 dias.'}
                </p>
              ) : (
                <div role="radiogroup" aria-label="Entrada do dinheiro" className="space-y-1.5">
                  {recData.recebimentos.map((r) => (
                    <button key={r.id} type="button" role="radio" aria-checked={escolhido === r.id} onClick={() => setEscolhido(r.id)}
                            className={`w-full min-h-11 px-3 rounded-xl border text-left flex items-center justify-between gap-2 ${escolhido === r.id ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
                      <span className="min-w-0">
                        <span className="block text-sm text-foreground truncate">{r.observacao || 'Entrada'}</span>
                        <span className="block text-[11px] text-muted-foreground">{r.data.slice(8, 10)}/{r.data.slice(5, 7)}</span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-green-600 dark:text-green-400 flex-shrink-0">{fmt(r.valor)}</span>
                    </button>
                  ))}
                  <button type="button" disabled={!escolhido || salvando} onClick={() => escolhido && registrar({ forma: 'vincular', transacao_id: escolhido })}
                          className="w-full h-11 rounded-xl text-sm font-bold text-white bg-primary disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
                    {salvando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} É este
                  </button>
                  <p className="text-[11px] text-muted-foreground">A entrada deixa de contar como receita (é o dinheiro da compra voltando).</p>
                </div>
              )}
              <button type="button" onClick={() => { setConta(null); setEscolhido(null); }} className="text-xs font-semibold text-muted-foreground underline underline-offset-2 min-h-9">Outra conta</button>
            </div>
          )}

          {erro && <p className="text-xs text-red-600" role="alert">{erro}</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Opcao({ Icone, titulo, texto, onClick, disabled }: { Icone: any; titulo: string; texto: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
            className="w-full min-h-11 px-3 py-2.5 rounded-xl border border-border bg-card hover:border-primary/50 text-left flex items-start gap-2.5 disabled:opacity-50">
      <Icone size={16} className="text-primary mt-0.5 flex-shrink-0" aria-hidden />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{titulo}</span>
        <span className="block text-[11px] text-muted-foreground">{texto}</span>
      </span>
    </button>
  );
}
