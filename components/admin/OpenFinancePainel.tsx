'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Landmark, Loader2, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Clock,
  Scale, Unplug, ExternalLink, Ban,
} from 'lucide-react';

// =============================================================================
// Aba "Open Finance" do painel admin.
//
// Responde três perguntas, nesta ordem — que é a ordem da urgência:
//   1. Estou cobrando alguém que não usa? (única lista ACIONÁVEL da tela)
//   2. Quem tem banco conectado, quantos, e de que plano?
//   3. O número da Polp bate com o meu?
//
// ⚠️ A ordem não é estética. A cobrança órfã é a única coisa aqui que custa
// dinheiro a alguém TODO MÊS enquanto ninguém olha — então ela abre a tela, e
// some sozinha quando zera (empty state em vez de bloco vazio permanente).
//
// Regras de UI aplicadas (skill ui-ux-pro-max):
//  · status é sempre ÍCONE + RÓTULO, nunca só cor (§1 color-not-only);
//  · cancelar é destrutivo: vermelho, separado, com confirmação (§8);
//  · botão desabilitado enquanto a chamada corre, com spinner (§2);
//  · números em `tabular-nums` (§6) e tabela com scroll horizontal no mobile.
// =============================================================================

const BRAND = 'hsl(var(--primary))';

const dataCurta = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

type Instituicao = { nome: string; status: string; ultimaSync: string | null; externalId: string | null };
type UsuarioOF = {
  id: string; email: string | null; nome: string | null; plano: string;
  vitalicio: boolean; assinaturaCancelada: boolean;
  conexoes: number; pagas: number; intervalo: string | null;
  temAssinatura: boolean; cobrancaOrfa: boolean; instituicoes: Instituicao[];
};
type Dados = {
  resumo: {
    conexoesAtivas: number; usuariosComConexao: number; desconectadas: number;
    conexoesPagas: number; receitaMes: number; cobrancasOrfas: number;
    totalCicloEstimado: number;
    porStatus: Record<string, number>; porInstituicao: Record<string, number>;
  };
  usuarios: UsuarioOF[];
  historico: {
    instituicao: string; statusFinal: string | null; criadaEm: string | null;
    desconectadaEm: string | null; motivo: string | null; email: string | null;
  }[];
};

// Status da conexão: ícone + palavra, pra não depender de cor.
function StatusConexao({ status }: { status: string }) {
  const mapa: Record<string, { Icon: typeof CheckCircle2; cor: string; label: string }> = {
    updated:  { Icon: CheckCircle2, cor: '#22c55e', label: 'sincronizado' },
    expired:  { Icon: Clock,        cor: '#f59e0b', label: 'expirado' },
    rejected: { Icon: XCircle,      cor: '#ef4444', label: 'recusado' },
  };
  const s = mapa[status] || { Icon: Clock, cor: '#94a3b8', label: status };
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: s.cor }}>
      <s.Icon size={11} /> {s.label}
    </span>
  );
}

export default function OpenFinancePainel() {
  const [dados, setDados]   = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro]     = useState('');
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [flash, setFlash]   = useState('');

  // Reconciliação com a Polp — chamada SEPARADA e sob demanda: ela vai até a
  // API deles e é lenta. Carregar junto faria a tela inteira esperar por algo
  // que só se olha de vez em quando.
  const [polp, setPolp] = useState<any>(null);
  const [polpLoad, setPolpLoad] = useState(false);
  const [polpErro, setPolpErro] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true); setErro('');
    try {
      const r = await fetch('/api/admin/open-finance', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || 'Falha ao carregar.');
      setDados(j);
    } catch (e: any) {
      setErro(e?.message || 'Falha ao carregar.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function conferirPolp() {
    setPolpLoad(true); setPolpErro(''); setPolp(null);
    try {
      const r = await fetch('/api/admin/of-consents', { cache: 'no-store' });
      const j = await r.json();
      if (j.erro) throw new Error(j.erro);
      setPolp(j);
    } catch (e: any) {
      setPolpErro(e?.message || 'Não consegui falar com a Polp.');
    } finally {
      setPolpLoad(false);
    }
  }

  async function cancelar(u: UsuarioOF) {
    // ⚠️ Confirmação nomeando QUEM e QUANTO — cancelar cobrança do cliente
    // errado é irreversível na prática (ele perde o banco no fim do período).
    const ok = confirm(
      `Cancelar a assinatura de conexão de ${u.email}?\n\n`
      + `• ${u.pagas} ${u.pagas === 1 ? 'conexão' : 'conexões'} · ${u.intervalo === 'anual' ? 'R$60/ano' : 'R$6/mês'}\n`
      + `• Bancos conectados hoje: ${u.conexoes}\n\n`
      + 'A cobrança para no FIM do período já pago — o acesso dele continua até lá.',
    );
    if (!ok) return;

    setCancelando(u.id); setFlash('');
    try {
      const r = await fetch('/api/admin/open-finance/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: u.id }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || 'Falha ao cancelar.');
      setFlash(
        j.jaCancelada
          ? `${u.email}: a assinatura já estava cancelada.`
          : `${u.email}: cancelada. Vale até ${dataCurta(j.cancelaEm)}.`,
      );
      await carregar();
    } catch (e: any) {
      setErro(e?.message || 'Falha ao cancelar.');
    } finally {
      setCancelando(null);
    }
  }

  if (carregando) {
    return (
      <div className="space-y-3">
        {/* Skeleton no FORMATO do conteúdo real — bloco de tamanho errado vira
            salto de layout quando o dado chega. */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[76px] rounded-2xl border border-border animate-pulse"
                 style={{ background: 'hsl(var(--bg-card) / 0.5)' }} />
          ))}
        </div>
        <div className="h-64 rounded-2xl border border-border animate-pulse"
             style={{ background: 'hsl(var(--bg-card) / 0.5)' }} />
      </div>
    );
  }

  if (erro && !dados) {
    return (
      <div className="rounded-2xl border border-red-300 dark:border-red-900/60 p-5 text-center">
        <AlertTriangle size={20} className="mx-auto mb-2 text-red-500" />
        <p className="text-sm font-semibold text-foreground">{erro}</p>
        <button onClick={carregar}
                className="mt-3 inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-border text-xs font-bold"
                style={{ minHeight: 44 }}>
          <RefreshCw size={13} /> Tentar de novo
        </button>
      </div>
    );
  }

  const r = dados!.resumo;
  const orfas = dados!.usuarios.filter((u) => u.cobrancaOrfa);

  return (
    <div className="space-y-4">
      {flash && (
        <div role="status" aria-live="polite"
             className="rounded-2xl border p-3 text-[13px] font-semibold"
             style={{ borderColor: 'color-mix(in srgb, #22c55e 35%, transparent)',
                      background: 'color-mix(in srgb, #22c55e 8%, transparent)' }}>
          {flash}
        </div>
      )}
      {erro && dados && (
        <div role="alert" className="rounded-2xl border border-red-300 dark:border-red-900/60 p-3 text-[13px] text-red-600 dark:text-red-400">
          {erro}
        </div>
      )}

      {/* ── Números ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
        <Card label="Conexões ativas" valor={r.conexoesAtivas} destaque
              hint={`${r.usuariosComConexao} usuários`} />
        <Card label="Pagas" valor={r.conexoesPagas}
              hint={`R$ ${r.receitaMes.toFixed(0)}/mês`} />
        <Card label="Desconectadas" valor={r.desconectadas} hint="no histórico" />
        <Card label="Total do ciclo" valor={r.totalCicloEstimado}
              hint="ativas + desconectadas" />
        <Card label="Cobrança órfã" valor={r.cobrancasOrfas}
              hint={r.cobrancasOrfas ? 'precisa cancelar' : 'nada a fazer'}
              alerta={r.cobrancasOrfas > 0} />
      </div>

      {/* ── 1. O ACIONÁVEL ────────────────────────────────────────────────── */}
      {orfas.length > 0 && (
        <section className="rounded-2xl border p-4 space-y-3"
                 style={{ borderColor: 'color-mix(in srgb, #ef4444 35%, transparent)',
                          background: 'color-mix(in srgb, #ef4444 5%, transparent)' }}>
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Pagando sem usar — {orfas.length} {orfas.length === 1 ? 'cliente' : 'clientes'}
              </h3>
              <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">
                Desconectaram o banco e a assinatura continuou. Acontece porque
                &quot;Desconectar&quot; remove a conexão mas não cancela a cobrança do Stripe.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {orfas.map((u) => (
              <div key={u.id}
                   className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-border/60 p-3"
                   style={{ background: 'hsl(var(--bg-card))' }}>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground truncate">{u.email}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                    paga <b className="text-foreground">{u.pagas}</b> ·{' '}
                    {u.intervalo === 'anual' ? 'R$60/ano' : `R$${u.pagas * 6}/mês`} ·{' '}
                    <b className="text-foreground">0</b> bancos conectados
                  </p>
                </div>
                <button
                  onClick={() => cancelar(u)}
                  disabled={cancelando === u.id}
                  aria-label={`Cancelar assinatura de conexão de ${u.email}`}
                  className="shrink-0 inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl text-xs font-bold text-white transition-all active:scale-[0.98] disabled:opacity-60"
                  style={{ background: '#ef4444', minHeight: 44 }}
                >
                  {cancelando === u.id
                    ? <><Loader2 size={13} className="animate-spin" /> Cancelando…</>
                    : <><Ban size={13} /> Cancelar cobrança</>}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 2. RECONCILIAÇÃO COM A POLP ───────────────────────────────────── */}
      <section className="rounded-2xl border border-border/60 p-4"
               style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Scale size={14} /> Conferir com a Polp
            </h3>
            <p className="text-[11.5px] text-muted-foreground mt-1 leading-relaxed max-w-xl">
              A Polp cobra por <b className="text-foreground">consentimento no ciclo</b>, não por
              conexão viva hoje. Uma conexão que durou 20 dias e foi desconectada entra na fatura
              daquele mês e some daqui — por isso o número deles costuma ser maior.
              Sua soma do ciclo: <b className="text-foreground tabular-nums">{r.totalCicloEstimado}</b>{' '}
              ({r.conexoesAtivas} ativas + {r.desconectadas} desconectadas).
            </p>
          </div>
          <button onClick={conferirPolp} disabled={polpLoad}
                  className="shrink-0 inline-flex items-center gap-2 h-10 px-3.5 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-foreground/5 disabled:opacity-60"
                  style={{ minHeight: 44 }}>
            {polpLoad ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {polpLoad ? 'Consultando…' : 'Consultar Polp'}
          </button>
        </div>

        {polpErro && <p role="alert" className="mt-3 text-[12px] text-red-500">{polpErro}</p>}

        {polp && (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-3 gap-2.5">
              <Mini label="Na Polp" valor={polp.na_polp} />
              <Mini label="Na Sora" valor={polp.na_sora} />
              <Mini label="Diferença" valor={polp.diferenca} alerta={Number(polp.diferenca) > 0} />
            </div>
            {Number(polp.orfaos_na_polp) > 0 && (
              <div className="rounded-xl border border-border/60 p-3">
                <p className="text-[12px] font-bold text-foreground">
                  {polp.orfaos_na_polp} consentimento(s) só na Polp
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  Existem lá e não aqui — normalmente conexão abandonada no meio ou reconexão
                  (cada uma cria um consent novo e o antigo continua). São os candidatos a revogar.
                </p>
              </div>
            )}
            <details className="text-[11px] text-muted-foreground">
              <summary className="cursor-pointer font-semibold text-foreground">
                Ver resposta completa
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-xl border border-border/60 p-3 text-[10px] leading-relaxed">
{JSON.stringify(polp, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </section>

      {/* ── 3. USUÁRIOS ───────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Usuários com Open Finance
          </h3>
          <button onClick={carregar} title="Atualizar"
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border text-[11px] font-bold text-muted-foreground hover:text-foreground">
            <RefreshCw size={12} /> Atualizar
          </button>
        </div>

        {dados!.usuarios.length === 0 ? (
          <div className="rounded-2xl border border-border/60 p-8 text-center">
            <Landmark size={22} className="mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Ninguém com Open Finance ainda</p>
          </div>
        ) : (
          /* Scroll horizontal no mobile — mesma regra das outras tabelas do painel. */
          <div className="overflow-x-auto rounded-2xl border border-border/60">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-border/60 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Plano</th>
                  <th className="p-3 text-center">Conexões</th>
                  <th className="p-3 text-center">Paga</th>
                  <th className="p-3">Bancos</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {dados!.usuarios.map((u) => (
                  <tr key={u.id} className="border-b border-border/40 last:border-0 align-top">
                    <td className="p-3 min-w-0">
                      <p className="text-[13px] font-semibold text-foreground truncate max-w-[220px]">
                        {u.email}
                      </p>
                      {u.nome && <p className="text-[11px] text-muted-foreground truncate max-w-[220px]">{u.nome}</p>}
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border border-border">
                        {u.plano}
                      </span>
                      {u.vitalicio && (
                        <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={{ background: 'color-mix(in srgb, #8b5cf6 16%, transparent)', color: '#8b5cf6' }}>
                          ∞ vitalício
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center text-[13px] font-bold text-foreground tabular-nums">
                      {u.conexoes}
                    </td>
                    <td className="p-3 text-center text-[13px] tabular-nums">
                      {u.pagas > 0 ? (
                        <span className="font-bold text-foreground">
                          {u.pagas}
                          <span className="block text-[10px] font-normal text-muted-foreground">
                            {u.intervalo === 'anual' ? 'anual' : 'mensal'}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">franquia</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1.5 max-w-[280px]">
                        {u.instituicoes.length === 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Unplug size={11} /> nenhum
                          </span>
                        )}
                        {u.instituicoes.map((i, k) => (
                          <span key={k}
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border/60 text-[11px]"
                                title={`última sync: ${dataCurta(i.ultimaSync)}`}>
                            <span className="font-semibold text-foreground">{i.nome}</span>
                            <StatusConexao status={i.status} />
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      {u.temAssinatura && (
                        <button
                          onClick={() => cancelar(u)}
                          disabled={cancelando === u.id}
                          aria-label={`Cancelar assinatura de conexão de ${u.email}`}
                          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border text-[11px] font-bold transition-colors disabled:opacity-60 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                          style={{ borderColor: 'color-mix(in srgb, #ef4444 40%, transparent)', minHeight: 44 }}
                        >
                          {cancelando === u.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : <Ban size={12} />}
                          Cancelar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── 4. DESCONECTADOS ──────────────────────────────────────────────── */}
      {dados!.historico.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Desconectados ({dados!.historico.length})
          </h3>
          <div className="overflow-x-auto rounded-2xl border border-border/60">
            <table className="w-full min-w-[600px] text-left">
              <thead>
                <tr className="border-b border-border/60 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Banco</th>
                  <th className="p-3">Conectou</th>
                  <th className="p-3">Desconectou</th>
                  <th className="p-3">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {dados!.historico.map((h, i) => (
                  <tr key={i} className="border-b border-border/40 last:border-0">
                    <td className="p-3 text-[12px] text-foreground truncate max-w-[200px]">{h.email || '—'}</td>
                    <td className="p-3 text-[12px] font-semibold text-foreground">{h.instituicao}</td>
                    <td className="p-3 text-[11px] text-muted-foreground tabular-nums">{dataCurta(h.criadaEm)}</td>
                    <td className="p-3 text-[11px] text-muted-foreground tabular-nums">{dataCurta(h.desconectadaEm)}</td>
                    <td className="p-3 text-[11px] text-muted-foreground">{h.motivo || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── 5. POR BANCO ──────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Por instituição
        </h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(r.porInstituicao)
            .sort((a, b) => b[1] - a[1])
            .map(([nome, n]) => (
              <span key={nome}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/60 text-[12px]"
                    style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
                <span className="text-foreground font-semibold">{nome}</span>
                <span className="tabular-nums font-bold" style={{ color: BRAND }}>{n}</span>
              </span>
            ))}
        </div>
      </section>
    </div>
  );
}

function Card({ label, valor, hint, destaque, alerta }: {
  label: string; valor: number | string; hint?: string; destaque?: boolean; alerta?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-3.5 ${alerta ? 'border-red-300 dark:border-red-900/60' : 'border-border'}`}
         style={destaque
           ? { background: `color-mix(in srgb, ${BRAND} 6%, transparent)`, borderColor: `color-mix(in srgb, ${BRAND} 25%, transparent)` }
           : { background: 'hsl(var(--bg-card) / 0.5)' }}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold tabular-nums mt-1 ${alerta ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}
         style={destaque ? { color: BRAND } : undefined}>{valor}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{hint}</p>}
    </div>
  );
}

function Mini({ label, valor, alerta }: { label: string; valor: number | string; alerta?: boolean }) {
  return (
    <div className="rounded-xl border border-border/60 p-2.5 text-center">
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${alerta ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
        {valor}
      </p>
    </div>
  );
}
