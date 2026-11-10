'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Landmark, Loader2, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Clock,
  Scale, Unplug, Ban, Building2,
} from 'lucide-react';
import { useConfirmar, useDecidir } from '@/contexts/ConfirmContext';

// =============================================================================
// Aba "Open Finance" do painel admin.
//
// Responde, na ordem da urgência:
//   1. Estou cobrando alguém que não usa? (cobrança órfã — acionável)
//   2. Estou PAGANDO a Polp por quem não usa? (sem acesso há 30+ dias, além do
//      direito do plano, banco repetido) — desconectar revoga lá.
//   3. O número da Polp bate com o meu? (e revogar o que só existe lá)
//
// ⚠️ A unidade é o CLIENTE DONO da conexão, a mesma do resumo do topo e da aba
// Usuários (ver app/api/admin/open-finance/route.ts). Antes cada tela contava
// de um jeito (grupo × grupo ativo × dono) e os números não fechavam.
//
// Status sempre ÍCONE + RÓTULO; ações destrutivas em vermelho, com o diálogo
// próprio do app (`window.confirm` some no navegador do WhatsApp).
// =============================================================================

const BRAND = 'hsl(var(--primary))';
const dataCurta = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

type Instituicao = { id: string; nome: string; status: string; ultimaSync: string | null; criadaEm: string | null; empresarial: boolean };
type ClienteOF = {
  id: string; email: string | null; nome: string | null; plano: string;
  vitalicio: boolean; assinaturaCancelada: boolean;
  conexoes: number; pagas: number; intervalo: string | null;
  temAssinatura: boolean; cobrancaOrfa: boolean; excedenteDesde: string | null;
  ultimoAcesso: string | null; diasSemAcesso: number | null; repetidas: number;
  instituicoes: Instituicao[];
};
type Dados = {
  resumo: {
    conexoesAtivas: number; clientesComConexao: number; comProblema: number;
    desconectadasTotal: number; desconectadasMes: number;
    conexoesPagas: number; receitaMes: number; cobrancasOrfas: number;
    alemDoDireito: number; semAcesso30: number; repetidas: number;
    totalCicloEstimado: number; inicioCiclo: string;
    porStatus: Record<string, number>; porInstituicao: Record<string, number>;
  };
  usuarios: ClienteOF[];
  historico: {
    instituicao: string; statusFinal: string | null; criadaEm: string | null;
    desconectadaEm: string | null; motivo: string | null; email: string | null;
  }[];
};
type Polp = {
  na_polp: number; na_sora: number; diferenca: number; polp_por_status: Record<string, number>;
  orfaos_na_polp: number;
  orfaos: { id: string; status: string; execution_status: string | null; institution_id: string | null; created_at: string | null }[];
  so_na_sora: { external_id: string; status: string; instituicao: string | null }[];
  erro?: string;
};

const FILTROS = [
  { id: 'todos', label: 'Todos' },
  { id: 'orfa', label: 'Pagando sem usar' },
  { id: 'inativo', label: 'Sem acesso há 30+ dias' },
  { id: 'excedente', label: 'Além do direito' },
  { id: 'repetido', label: 'Banco repetido' },
  { id: 'problema', label: 'Parou de atualizar' },
] as const;
type Filtro = (typeof FILTROS)[number]['id'];

const MOTIVO: Record<string, string> = {
  usuario: 'cliente desconectou', excedente: 'corte de excedente', admin: 'pelo admin',
  exclusao_conta: 'conta excluída',
};
const STATUS_POLP: Record<string, string> = {
  AUTHORISED: 'autorizado (cobrado)', AWAITING_AUTHORIZATION: 'abandonado no meio', REJECTED: 'rejeitado', EXPIRED: 'expirado',
};

function StatusConexao({ status }: { status: string }) {
  const mapa: Record<string, { Icon: typeof CheckCircle2; cor: string; label: string }> = {
    updated:  { Icon: CheckCircle2, cor: '#22c55e', label: 'ok' },
    expired:  { Icon: Clock,        cor: '#f59e0b', label: 'expirado' },
    rejected: { Icon: XCircle,      cor: '#ef4444', label: 'recusado' },
  };
  const s = mapa[status] || { Icon: Clock, cor: '#94a3b8', label: status };
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold" style={{ color: s.cor }}>
      <s.Icon size={10} /> {s.label}
    </span>
  );
}

export default function OpenFinancePainel({ flash }: { flash?: (m: string) => void }) {
  const confirmar = useConfirmar();
  const decidir = useDecidir();
  const avisar = flash || (() => {});
  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');

  // Reconciliação com a Polp — SOB DEMANDA: vai até a API deles e é lenta.
  const [polp, setPolp] = useState<Polp | null>(null);
  const [polpLoad, setPolpLoad] = useState(false);
  const [polpErro, setPolpErro] = useState('');

  const carregar = useCallback(async () => {
    setErro('');
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
    setPolpLoad(true); setPolpErro('');
    try {
      const r = await fetch('/api/admin/of-consents', { cache: 'no-store' });
      const j = await r.json();
      if (j.erro) throw new Error(j.erro + (j.dica ? ` ${j.dica}` : ''));
      setPolp(j);
    } catch (e: any) {
      setPolpErro(e?.message || 'Não consegui falar com a Polp.');
    } finally {
      setPolpLoad(false);
    }
  }

  async function desconectar(u: ClienteOF, i: Instituicao) {
    const ok = await confirmar({
      titulo: `Desconectar ${i.nome} de ${u.email}?`,
      mensagem: (
        <>
          O consentimento é revogado na Polp e para de contar na fatura dela. As contas e o histórico do
          cliente ficam na Sora, só param de atualizar; ele pode reconectar quando quiser.
          {u.temAssinatura && <><br /><br />A cobrança da conexão no Stripe <b className="text-foreground">continua</b>: cancele à parte se for o caso.</>}
        </>
      ),
      confirmar: 'Desconectar', cancelar: 'Voltar', perigo: true,
    });
    if (!ok) return;
    setOcupado(i.id);
    try {
      const r = await fetch('/api/admin/open-finance/desconectar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conexaoId: i.id }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erro || `Erro ${r.status}`);
      avisar(`${i.nome} de ${u.email}: desconectado e revogado na Polp ✓`);
      await carregar();
    } catch (e: any) { avisar('⚠️ ' + (e?.message || 'falhou')); }
    finally { setOcupado(null); }
  }

  async function cancelarCobranca(u: ClienteOF) {
    const r = await decidir({
      titulo: `Cancelar a cobrança de conexão de ${u.email}?`,
      mensagem: (
        <>
          {u.pagas} {u.pagas === 1 ? 'conexão' : 'conexões'} · {u.intervalo === 'anual' ? 'R$ 60/ano cada' : 'R$ 6/mês cada'} ·
          {' '}{u.conexoes} {u.conexoes === 1 ? 'banco conectado' : 'bancos conectados'} hoje.
          <br /><br />
          <b className="text-foreground">No fim do período</b> (recomendado): usa o que já pagou e não renova.
          {' '}<b className="text-foreground">Agora</b>: encerra hoje, sem reembolso automático.
        </>
      ),
      confirmar: 'No fim do período', alternativa: 'Cancelar agora', cancelar: 'Voltar', perigo: true,
    });
    if (r === 'cancelar') return;
    setOcupado(u.id);
    try {
      const res = await fetch('/api/admin/open-finance/cancelar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: u.id, acao: r === 'alternativa' ? 'cancelar_agora' : 'cancelar' }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.erro || `Erro ${res.status}`);
      avisar(`${u.email}: ${j.mensagem || 'cancelada'}${j.cancelaEm ? ` (vale até ${dataCurta(j.cancelaEm)})` : ''}`);
      await carregar();
    } catch (e: any) { avisar('⚠️ ' + (e?.message || 'falhou')); }
    finally { setOcupado(null); }
  }

  async function revogarOrfao(o: Polp['orfaos'][number]) {
    const ok = await confirmar({
      titulo: 'Revogar este consentimento na Polp?',
      mensagem: (
        <>
          Ele existe só na Polp ({STATUS_POLP[o.status] || o.status}, criado {dataCurta(o.created_at)}) e não
          aparece em nenhuma tela da Sora. Revogar encerra o acesso a esses dados e tira ele da conta deles.
          Não dá pra desfazer: se o cliente quiser, conecta de novo.
        </>
      ),
      confirmar: 'Revogar', cancelar: 'Voltar', perigo: true,
    });
    if (!ok) return;
    setOcupado(o.id);
    try {
      const r = await fetch('/api/admin/open-finance/revogar-consentimento', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ consentId: o.id }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erro || `Erro ${r.status}`);
      setPolp((p) => p && { ...p, orfaos: p.orfaos.filter((x) => x.id !== o.id), orfaos_na_polp: p.orfaos_na_polp - 1, na_polp: p.na_polp - 1, diferenca: p.diferenca - 1 });
      avisar('Revogado na Polp ✓');
    } catch (e: any) { avisar('⚠️ ' + (e?.message || 'falhou')); }
    finally { setOcupado(null); }
  }

  const lista = useMemo(() => {
    const us = dados?.usuarios || [];
    switch (filtro) {
      case 'orfa': return us.filter((u) => u.cobrancaOrfa);
      case 'inativo': return us.filter((u) => u.conexoes > 0 && (u.diasSemAcesso ?? 0) >= 30)
        .sort((a, b) => (b.diasSemAcesso ?? 0) - (a.diasSemAcesso ?? 0));
      case 'excedente': return us.filter((u) => u.excedenteDesde && u.conexoes > 0);
      case 'repetido': return us.filter((u) => u.repetidas > 0);
      case 'problema': return us.filter((u) => u.instituicoes.some((i) => i.status !== 'updated'));
      default: return us;
    }
  }, [dados, filtro]);

  if (carregando) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[84px] rounded-2xl border border-border animate-pulse" style={{ background: 'hsl(var(--bg-card) / 0.5)' }} />
          ))}
        </div>
        <div className="h-64 rounded-2xl border border-border animate-pulse" style={{ background: 'hsl(var(--bg-card) / 0.5)' }} />
      </div>
    );
  }

  if (erro && !dados) {
    return (
      <div className="rounded-2xl border border-red-300 dark:border-red-900/60 p-5 text-center">
        <AlertTriangle size={20} className="mx-auto mb-2 text-red-500" />
        <p className="text-sm font-semibold text-foreground">{erro}</p>
        <button onClick={carregar} className="mt-3 inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-border text-xs font-bold">
          <RefreshCw size={13} /> Tentar de novo
        </button>
      </div>
    );
  }

  const r = dados!.resumo;
  const contagem: Record<Filtro, number> = {
    todos: dados!.usuarios.length,
    orfa: r.cobrancasOrfas,
    inativo: r.semAcesso30,
    excedente: r.alemDoDireito,
    repetido: dados!.usuarios.filter((u) => u.repetidas > 0).length,
    problema: dados!.usuarios.filter((u) => u.instituicoes.some((i) => i.status !== 'updated')).length,
  };
  const mesCiclo = new Date(r.inicioCiclo).toLocaleDateString('pt-BR', { month: 'long', timeZone: 'America/Sao_Paulo' });

  return (
    <div className="space-y-5">
      {erro && dados && (
        <div role="alert" className="rounded-2xl border border-red-300 dark:border-red-900/60 p-3 text-[13px] text-red-600 dark:text-red-400">{erro}</div>
      )}

      {/* ── Números ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Card label="Bancos conectados" valor={r.conexoesAtivas} destaque
              hint={`${r.clientesComConexao} clientes${r.comProblema ? ` · ${r.comProblema} parou de atualizar` : ''}`} />
        <Card label={`Na conta da Polp (${mesCiclo})`} valor={r.totalCicloEstimado}
              hint={`${r.conexoesAtivas} ativas + ${r.desconectadasMes} que saíram no mês`} />
        <Card label="Conexões pagas" valor={r.conexoesPagas}
              hint={`avulsas, além da franquia · ≈ R$ ${r.receitaMes.toFixed(0)}/mês com os anuais divididos por 12`} />
        <Card label="Para revisar" valor={r.cobrancasOrfas + r.semAcesso30 + r.alemDoDireito + r.repetidas}
              alerta={r.cobrancasOrfas > 0}
              hint={`${r.cobrancasOrfas} pagando sem usar · ${r.semAcesso30} sem acesso · ${r.alemDoDireito} além do direito · ${r.repetidas} repetido`} />
      </div>

      {/* ── 1. Conferir com a Polp ── */}
      <section className="rounded-2xl border border-border/60 p-4 space-y-3" style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Scale size={14} /> Conferir com a Polp</h3>
            <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed max-w-2xl">
              Compara os consentimentos que a Polp tem com as {r.conexoesAtivas} conexões da Sora. O que existir
              só lá (reconexão que deixou o antigo vivo, conexão abandonada no meio) entra na fatura deles sem
              aparecer em tela nenhuma — dá pra revogar daqui.
            </p>
          </div>
          <button onClick={conferirPolp} disabled={polpLoad}
                  className="shrink-0 inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-foreground/5 disabled:opacity-60">
            {polpLoad ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {polpLoad ? 'Consultando…' : polp ? 'Consultar de novo' : 'Consultar Polp'}
          </button>
        </div>
        {polpErro && <p role="alert" className="text-[12px] text-red-500">{polpErro}</p>}
        {polp && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2.5">
              <Mini label="Na Polp" valor={polp.na_polp} />
              <Mini label="Na Sora" valor={polp.na_sora} />
              <Mini label="Diferença" valor={polp.diferenca} alerta={Number(polp.diferenca) > 0} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Na Polp, por status: {Object.entries(polp.polp_por_status || {}).map(([k, n]) => `${STATUS_POLP[k] || k}: ${n}`).join(' · ') || '—'}
            </p>
            {polp.orfaos.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-[12px] font-bold text-foreground">Só na Polp ({polp.orfaos_na_polp})</p>
                {polp.orfaos.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-2 rounded-xl border border-border/60 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-foreground">{STATUS_POLP[o.status] || o.status}</p>
                      <p className="text-[11px] text-muted-foreground font-mono truncate">{o.id} · {dataCurta(o.created_at)}</p>
                    </div>
                    <button onClick={() => revogarOrfao(o)} disabled={!!ocupado}
                            className="shrink-0 inline-flex items-center gap-1 h-9 px-3 rounded-lg border text-[11px] font-bold text-red-600 dark:text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                            style={{ borderColor: 'color-mix(in srgb, #ef4444 40%, transparent)' }}>
                      {ocupado === o.id ? <Loader2 size={12} className="animate-spin" /> : <Ban size={12} />} Revogar
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] font-semibold text-emerald-600 inline-flex items-center gap-1.5"><CheckCircle2 size={13} /> Nada sobrando na Polp.</p>
            )}
            {polp.so_na_sora?.length > 0 && (
              <p className="text-[11px] text-amber-600">
                {polp.so_na_sora.length} conexão(ões) existem aqui e a Polp não conhece: {polp.so_na_sora.map((s) => s.instituicao || s.external_id).join(', ')}. Elas não sincronizam mais; desconecte.
              </p>
            )}
          </div>
        )}
      </section>

      {/* ── 2. Clientes ── */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-foreground">Clientes com Open Finance</h3>
          <button onClick={() => { setCarregando(false); carregar(); }}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border text-[11px] font-bold text-muted-foreground hover:text-foreground">
            <RefreshCw size={12} /> Atualizar
          </button>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTROS.map((f) => (
            <button key={f.id} onClick={() => setFiltro(f.id)} aria-pressed={filtro === f.id}
                    className={`h-9 px-3 rounded-xl text-xs font-bold whitespace-nowrap border flex-shrink-0 ${filtro === f.id ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground hover:text-foreground'}`}>
              {f.label} <span className="tabular-nums opacity-70">{contagem[f.id]}</span>
            </button>
          ))}
        </div>
        {filtro === 'inativo' && (
          <p className="text-[11px] text-muted-foreground">Não abrem o painel há 30 dias ou mais. O WhatsApp pode continuar em uso: confira antes de desconectar.</p>
        )}
        {filtro === 'excedente' && (
          <p className="text-[11px] text-muted-foreground">O aviso de 48h já saiu (JOB 1R) e o corte é automático; desconectar aqui só adianta.</p>
        )}

        {lista.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-[13px] text-muted-foreground">
            Ninguém neste filtro.
          </div>
        ) : (
          <div className="space-y-2">
            {lista.map((u) => (
              <article key={u.id} className={`rounded-2xl border p-3.5 space-y-2.5 ${u.cobrancaOrfa ? 'border-red-300 dark:border-red-900/60' : 'border-border/60'}`}
                       style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-foreground break-all">{u.email}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="px-1.5 py-0.5 rounded-md border border-border text-[10px] font-bold">{u.plano}{u.vitalicio ? ' · vitalício' : ''}</span>
                      <span className="tabular-nums">
                        {u.pagas > 0 ? `paga ${u.pagas} (${u.intervalo === 'anual' ? 'anual' : 'mensal'})` : 'pela franquia'}
                      </span>
                      <span className={(u.diasSemAcesso ?? 0) >= 30 ? 'text-amber-600 font-semibold' : ''}>
                        {u.ultimoAcesso ? `último acesso ${u.diasSemAcesso === 0 ? 'hoje' : `há ${u.diasSemAcesso} dias`}` : 'nunca acessou o painel'}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {u.cobrancaOrfa && <Selo cor="#ef4444" icone={<AlertTriangle size={10} />}>paga e não tem banco</Selo>}
                      {u.excedenteDesde && u.conexoes > 0 && <Selo cor="#f59e0b" icone={<Clock size={10} />}>além do direito desde {dataCurta(u.excedenteDesde)}</Selo>}
                      {u.repetidas > 0 && <Selo cor="#f59e0b" icone={<AlertTriangle size={10} />}>mesmo banco {u.repetidas + 1}×</Selo>}
                      {u.assinaturaCancelada && <Selo cor="#94a3b8">plano cancelado</Selo>}
                    </div>
                  </div>
                  {u.temAssinatura && (
                    <button onClick={() => cancelarCobranca(u)} disabled={!!ocupado}
                            aria-label={`Cancelar cobrança de conexão de ${u.email}`}
                            className={`shrink-0 inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-[11px] font-bold disabled:opacity-60 ${u.cobrancaOrfa ? 'text-white bg-red-500 hover:bg-red-600' : 'border text-red-600 dark:text-red-400 hover:bg-red-500/10'}`}
                            style={u.cobrancaOrfa ? undefined : { borderColor: 'color-mix(in srgb, #ef4444 40%, transparent)' }}>
                      {ocupado === u.id ? <Loader2 size={12} className="animate-spin" /> : <Ban size={12} />} Cancelar cobrança
                    </button>
                  )}
                </div>
                {u.instituicoes.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {u.instituicoes.map((i) => (
                      <li key={i.id} className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg border border-border/60 text-[11px]"
                          title={`última sincronização: ${dataCurta(i.ultimaSync)} · desde ${dataCurta(i.criadaEm)}`}>
                        {i.empresarial ? <Building2 size={11} /> : <Landmark size={11} />}
                        <span className="font-semibold text-foreground">{i.nome}{i.empresarial ? ' PJ' : ''}</span>
                        <StatusConexao status={i.status} />
                        <button onClick={() => desconectar(u, i)} disabled={!!ocupado}
                                aria-label={`Desconectar ${i.nome} de ${u.email}`} title="Desconectar (revoga na Polp)"
                                className="ml-0.5 h-7 px-1.5 rounded-md text-red-600 dark:text-red-400 hover:bg-red-500/10 inline-flex items-center gap-1 font-bold disabled:opacity-50">
                          {ocupado === i.id ? <Loader2 size={11} className="animate-spin" /> : <Unplug size={11} />}
                          <span className="hidden sm:inline">Desconectar</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Unplug size={11} /> nenhum banco conectado</p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ── 3. Desconectados ── */}
      {dados!.historico.length > 0 && (
        <details className="rounded-2xl border border-border/60 p-4" style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
          <summary className="cursor-pointer text-sm font-bold text-foreground">
            Desconectados <span className="tabular-nums font-semibold text-muted-foreground">({r.desconectadasTotal} no total · {r.desconectadasMes} em {mesCiclo})</span>
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[600px] text-left">
              <thead>
                <tr className="border-b border-border/60 text-[11px] font-bold text-muted-foreground">
                  <th className="p-2">Cliente</th><th className="p-2">Banco</th><th className="p-2">Conectou</th>
                  <th className="p-2">Desconectou</th><th className="p-2">Por quê</th>
                </tr>
              </thead>
              <tbody>
                {dados!.historico.map((h, i) => (
                  <tr key={i} className="border-b border-border/40 last:border-0">
                    <td className="p-2 text-[12px] text-foreground truncate max-w-[200px]">{h.email || '—'}</td>
                    <td className="p-2 text-[12px] font-semibold text-foreground">{h.instituicao}</td>
                    <td className="p-2 text-[11px] text-muted-foreground tabular-nums">{dataCurta(h.criadaEm)}</td>
                    <td className="p-2 text-[11px] text-muted-foreground tabular-nums">{dataCurta(h.desconectadaEm)}</td>
                    <td className="p-2 text-[11px] text-muted-foreground">{(h.motivo && MOTIVO[h.motivo]) || h.motivo || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {r.desconectadasTotal > dados!.historico.length && (
              <p className="text-[11px] text-muted-foreground mt-2">Mostrando as {dados!.historico.length} mais recentes.</p>
            )}
          </div>
        </details>
      )}

      {/* ── 4. Por banco ── */}
      <section className="space-y-2">
        <h3 className="text-sm font-bold text-foreground">Por banco</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(r.porInstituicao).sort((a, b) => b[1] - a[1]).map(([nome, n]) => (
            <span key={nome} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/60 text-[12px]"
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

function Selo({ cor, icone, children }: { cor: string; icone?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold"
          style={{ background: `color-mix(in srgb, ${cor} 15%, transparent)`, color: cor }}>
      {icone}{children}
    </span>
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
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold tabular-nums mt-1 ${alerta ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}
         style={destaque ? { color: BRAND } : undefined}>{valor}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{hint}</p>}
    </div>
  );
}

function Mini({ label, valor, alerta }: { label: string; valor: number | string; alerta?: boolean }) {
  return (
    <div className="rounded-xl border border-border/60 p-2.5 text-center">
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${alerta ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>{valor}</p>
    </div>
  );
}
