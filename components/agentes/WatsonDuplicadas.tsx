'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Loader2, Trash2, Undo2, CheckCircle2, AlertTriangle, HelpCircle, CreditCard, Globe } from 'lucide-react';
import { api } from '@/lib/api';

// =============================================================================
// A investigação do Detetive Watson, dentro do card dele.
//
// DUAS LISTAS, NUNCA MISTURADAS:
//   · "Confirmadas" — ele tem PROVA (mesmo milissegundo, ou manual × banco).
//   · "Pode ser"    — só coincidência (mesmo valor e descrição em 1 dia).
// Medido na base real: a regra das suspeitas acusa 27 pares e a MAIORIA é
// legítima (dois Pix iguais pro mesmo lugar no mesmo dia acontece). Por isso
// suspeita aparece com outro visual, outro texto e nunca pré-selecionada — se
// o agente acusar inocente, o usuário para de confiar nele e desliga.
//
// EXCLUSÃO: some da tela na hora e só vai pro servidor depois de ~10s, com
// "Desfazer" visível. Transação apagada não volta, então o desfazer é o que
// torna o toque errado barato.
// =============================================================================

const COR = '#6366f1';   // mesma do agente no catálogo
const ESPERA_DESFAZER = 10_000;

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const dataCurta = (d: string) => {
  const s = String(d || '').slice(0, 10).split('-');
  return s.length === 3 ? `${s[2]}/${s[1]}` : '';
};

type Grupo = { motivo: string; explicacao: string; transacoes: any[] };

export default function WatsonDuplicadas({ phone }: { phone: string }) {
  const [carregando, setCarregando] = useState(false);
  const [rodou, setRodou]           = useState(false);
  const [erro, setErro]             = useState('');
  const [grupos, setGrupos]         = useState<Grupo[]>([]);
  const [suspeitas, setSuspeitas]   = useState<Grupo[]>([]);
  const [escopo, setEscopo]         = useState<any>(null);

  // Cartões pro seletor de escopo (só carrega quando o card abre).
  const [cartoes, setCartoes] = useState<any[]>([]);
  const [alvo, setAlvo]       = useState<string>('geral');

  // Exclusão otimista: some da tela, vai pro servidor em ESPERA_DESFAZER.
  const [apagados, setApagados] = useState<Record<string, any>>({});
  const timers = useRef<Record<string, any>>({});

  useEffect(() => {
    let vivo = true;
    api.wallets.listar(phone)
      .then((ws) => { if (vivo) setCartoes((ws || []).filter((w: any) => w.tipo === 'Crédito')); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [phone]);

  // Se o card fechar com exclusão pendente, ela ainda precisa acontecer —
  // o usuário mandou apagar; sair da tela não é "desfazer".
  useEffect(() => () => {
    Object.entries(timers.current).forEach(([id, t]) => {
      clearTimeout(t);
      api.transacoes.deletar(id).catch(() => {});
    });
  }, []);

  const investigar = useCallback(async () => {
    setCarregando(true); setErro('');
    try {
      const r = await api.transacoes.duplicadas(phone,
        alvo === 'geral' ? { dias: 90 } : { cartao: alvo });
      setGrupos(r.grupos || []);
      setSuspeitas(r.suspeitas || []);
      setEscopo(r.escopo || null);
      setRodou(true);
    } catch (e: any) {
      setErro(e?.message || 'Não consegui investigar agora.');
    } finally {
      setCarregando(false);
    }
  }, [phone, alvo]);

  function apagar(t: any) {
    setApagados((m) => ({ ...m, [t.id]: t }));
    timers.current[t.id] = setTimeout(() => {
      api.transacoes.deletar(t.id).catch(() => {
        // Falhou de verdade: devolve pra tela em vez de sumir calado.
        setApagados((m) => { const n = { ...m }; delete n[t.id]; return n; });
        setErro('Não consegui excluir um lançamento. Tente de novo.');
      });
      delete timers.current[t.id];
    }, ESPERA_DESFAZER);
  }

  function desfazer(id: string) {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setApagados((m) => { const n = { ...m }; delete n[id]; return n; });
  }

  const pendentes = Object.values(apagados);
  const visiveis = (lista: Grupo[]) => lista
    .map((g) => ({ ...g, transacoes: g.transacoes.filter((t) => !apagados[t.id]) }))
    .filter((g) => g.transacoes.length > 1);

  const confVis = visiveis(grupos);
  const suspVis = visiveis(suspeitas);
  const limpo = rodou && !confVis.length && !suspVis.length;

  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        Investigar agora
      </h3>

      {/* Escopo + botão */}
      <div className="rounded-2xl border border-border/50 p-3.5 space-y-3"
           style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
        <div className="flex flex-wrap gap-2">
          <BotaoEscopo ativo={alvo === 'geral'} onClick={() => setAlvo('geral')} icon={Globe}>
            Tudo (90 dias)
          </BotaoEscopo>
          {cartoes.map((c) => (
            <BotaoEscopo key={c.id} ativo={alvo === c.id} onClick={() => setAlvo(c.id)} icon={CreditCard}>
              {c.nome}
            </BotaoEscopo>
          ))}
        </div>
        {cartoes.length > 0 && alvo !== 'geral' && (
          <p className="text-[11px] text-muted-foreground">
            Analisa a <strong className="text-foreground">fatura atual</strong> desse cartão — o ciclo real de
            fechamento, que pode cruzar dois meses.
          </p>
        )}

        <button
          type="button" onClick={investigar} disabled={carregando}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white transition active:scale-[0.99] disabled:opacity-60"
          style={{ background: COR, minHeight: 44 }}
        >
          {carregando ? <><Loader2 size={15} className="animate-spin" /> Investigando…</>
                      : <><Search size={15} /> {rodou ? 'Investigar de novo' : 'Procurar duplicadas'}</>}
        </button>

        {escopo?.tipo === 'fatura' && (
          <p className="text-[11px] text-muted-foreground tabular">
            Fatura de {escopo.competencia} · {dataCurta(escopo.ini)} a {dataCurta(escopo.fim)}
          </p>
        )}
        {erro && <p className="text-[12px] text-red-600 dark:text-red-400">{erro}</p>}
      </div>

      {/* Desfazer */}
      {pendentes.length > 0 && (
        <div className="rounded-2xl border p-3 flex items-center gap-3"
             style={{ borderColor: 'color-mix(in srgb, #22c55e 35%, transparent)',
                      background: 'color-mix(in srgb, #22c55e 8%, transparent)' }}>
          <CheckCircle2 size={16} className="text-green-500 shrink-0" />
          <p className="text-[12px] text-foreground flex-1 min-w-0">
            {pendentes.length === 1 ? '1 lançamento excluído' : `${pendentes.length} lançamentos excluídos`}
          </p>
          <button type="button"
                  onClick={() => pendentes.forEach((t: any) => desfazer(t.id))}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold text-foreground hover:bg-foreground/10"
                  style={{ minHeight: 44 }}>
            <Undo2 size={13} /> Desfazer
          </button>
        </div>
      )}

      {limpo && (
        <div className="rounded-2xl border border-border/50 p-5 text-center">
          <CheckCircle2 size={22} className="mx-auto mb-2 text-green-500" />
          <p className="text-[13px] font-semibold text-foreground">Nada repetido por aqui</p>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            Examinei cada lançamento. Nenhuma compra entrou duas vezes.
          </p>
        </div>
      )}

      {confVis.length > 0 && (
        <Bloco
          titulo="Duplicadas confirmadas" cor="#ef4444" Icone={AlertTriangle}
          legenda="Tenho prova de que é a mesma compra. O primeiro é o mais antigo — costuma ser o que vale manter."
          grupos={confVis} onApagar={apagar}
        />
      )}

      {suspVis.length > 0 && (
        <Bloco
          titulo="Pode ser repetido" cor="#f59e0b" Icone={HelpCircle}
          legenda="Aqui eu não tenho prova — só coincidência de valor e descrição. Compra repetida de verdade acontece. Confira antes de apagar."
          grupos={suspVis} onApagar={apagar}
        />
      )}
    </section>
  );
}

function BotaoEscopo({ ativo, onClick, icon: Icon, children }: any) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold transition ${
        ativo ? 'text-white' : 'text-muted-foreground hover:text-foreground bg-muted/50'}`}
      style={{ background: ativo ? COR : undefined, minHeight: 40 }}>
      <Icon size={13} /> {children}
    </button>
  );
}

function Bloco({ titulo, cor, Icone, legenda, grupos, onApagar }: any) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icone size={14} style={{ color: cor }} />
        <h4 className="text-[12px] font-bold text-foreground">{titulo}</h4>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white tabular" style={{ background: cor }}>
          {grupos.length}
        </span>
      </div>
      <p className="text-[11.5px] leading-relaxed text-muted-foreground">{legenda}</p>

      {grupos.map((g: Grupo, i: number) => (
        <div key={i} className="rounded-2xl border p-3.5 space-y-2.5"
             style={{ borderColor: `color-mix(in srgb, ${cor} 30%, transparent)`,
                      background: `color-mix(in srgb, ${cor} 5%, transparent)` }}>
          <p className="text-[11.5px] italic leading-relaxed text-muted-foreground">{g.explicacao}</p>

          {g.transacoes.map((t: any, j: number) => (
            <div key={t.id} className="flex items-center gap-3 rounded-xl border border-border/50 p-2.5"
                 style={{ background: 'hsl(var(--bg-card))' }}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-foreground">
                  {t.observacao || t.categoria || 'Lançamento'}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground tabular">
                  {/* ⚠️ A DIREÇÃO É ESCRITA, não uma cor. O Watson passou a
                      enxergar duplicata de RECEITA também (antes a query dele
                      travava em 'Gasto'), então entrada e saída convivem na
                      mesma lista — e apagar a linha errada por não saber qual
                      é qual seria o pior desfecho possível aqui. */}
                  {t.tipo === 'Recebimento' ? 'entrada' : 'saída'} · {brl(t.valor)} · {dataCurta(t.data)} · {t.carteira_nome}
                  {j === 0 && <span className="ml-1.5 font-semibold text-foreground">· o mais antigo</span>}
                </p>
              </div>
              <button type="button" onClick={() => onApagar(t)}
                      aria-label={`Excluir ${t.observacao || 'lançamento'} de ${brl(t.valor)}`}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted-foreground transition hover:bg-red-500/10 hover:text-red-500">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
