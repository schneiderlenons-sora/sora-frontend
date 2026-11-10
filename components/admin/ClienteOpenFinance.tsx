'use client';

// =============================================================================
// Open Finance de UM cliente, dentro do painel lateral do admin.
//
// Duas ações, de propósito SEPARADAS (pedido do dono, nov/2026):
//   · DESCONECTAR um banco → revoga o consentimento na Polp (para de contar lá).
//     As contas e o histórico do cliente ficam; ele pode reconectar.
//   · CANCELAR A COBRANÇA da conexão no Stripe → para de cobrar o cliente.
// Juntá-las faria um clique tirar o banco E a receita de quem só queria trocar
// de banco — e quem conecta pela franquia do plano nem tem cobrança.
//
// A assinatura é lida AO VIVO do Stripe: o que interessa aqui é justamente
// quando a Sora e o Stripe discordam (medido: 2 assinaturas canceladas lá
// seguiam "pagas" aqui). Aí aparece "Conferir com o Stripe".
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { Landmark, Loader2, Unplug, Ban, Undo2, RefreshCw, AlertTriangle, CheckCircle2, Clock, Building2 } from 'lucide-react';
import { useConfirmar, useDecidir } from '@/contexts/ConfirmContext';

type Dados = {
  conexoes: { id: string; instituicao: string; status: string; ultimaSync: string | null; criadaEm: string | null; empresarial: boolean }[];
  pagasNaSora: number;
  intervalo: string | null;
  assinatura: null | { erro: string } | {
    id: string; status: string; cancelaNoFim: boolean; fimPeriodo: string | null;
    quantidade: number | null; intervalo: 'mensal' | 'anual'; valorUnitario: number | null;
  };
  divergencia: string | null;
};

const data = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const STATUS_STRIPE: Record<string, string> = {
  active: 'Ativa', past_due: 'Pagamento atrasado', canceled: 'Encerrada', unpaid: 'Não paga',
  incomplete: 'Incompleta', incomplete_expired: 'Expirou', trialing: 'Em teste', paused: 'Pausada',
};

export default function ClienteOpenFinance({ userId, email, flash, onMudou }: {
  userId: string; email: string | null; flash: (m: string) => void; onMudou: () => void;
}) {
  const confirmar = useConfirmar();
  const decidir = useDecidir();
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro('');
    try {
      const r = await fetch(`/api/admin/open-finance/usuario?userId=${userId}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || `Erro ${r.status}`);
      setD(j);
    } catch (e: any) { setErro(e?.message || 'Não consegui carregar o Open Finance.'); }
  }, [userId]);
  useEffect(() => { carregar(); }, [carregar]);   // o pai remonta por `key` ao trocar de cliente

  async function desconectar(c: Dados['conexoes'][number]) {
    const ok = await confirmar({
      titulo: `Desconectar ${c.instituicao}?`,
      mensagem: (
        <>
          O consentimento é revogado na Polp e para de contar na fatura dela. As contas, os cartões e o
          histórico de <b className="text-foreground">{email || 'o cliente'}</b> continuam na Sora, só param de atualizar.
          <br /><br />
          Isso <b className="text-foreground">não cancela</b> a cobrança da conexão no Stripe (é o outro botão).
        </>
      ),
      confirmar: 'Desconectar', cancelar: 'Voltar', perigo: true,
    });
    if (!ok) return;
    setOcupado(c.id);
    try {
      const r = await fetch('/api/admin/open-finance/desconectar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conexaoId: c.id }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erro || `Erro ${r.status}`);
      flash(`${c.instituicao} desconectado ✓ (revogado na Polp)`);
      await carregar(); onMudou();
    } catch (e: any) { flash('⚠️ ' + (e?.message || 'falhou')); }
    finally { setOcupado(null); }
  }

  async function assinatura(acao: 'cancelar' | 'cancelar_agora' | 'reativar' | 'sincronizar') {
    setOcupado(acao);
    try {
      const r = await fetch('/api/admin/open-finance/cancelar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, acao }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erro || `Erro ${r.status}`);
      flash(j.mensagem || 'Feito ✓');
      await carregar(); onMudou();
    } catch (e: any) { flash('⚠️ ' + (e?.message || 'falhou')); }
    finally { setOcupado(null); }
  }

  async function pedirCancelamento() {
    if (!d?.assinatura || 'erro' in d.assinatura) return;
    const a = d.assinatura;
    const r = await decidir({
      titulo: 'Cancelar a cobrança da conexão?',
      mensagem: (
        <>
          <b className="text-foreground">{email}</b> paga {a.quantidade ?? d.pagasNaSora} conexão(ões) ·{' '}
          {a.intervalo === 'anual' ? 'anual' : 'mensal'}.
          <br /><br />
          <b className="text-foreground">No fim do período</b> (recomendado): ele usa até {data(a.fimPeriodo)}, que já pagou, e a
          cobrança não renova. <b className="text-foreground">Agora</b>: encerra hoje, sem reembolso automático.
          <br /><br />
          Os bancos continuam conectados se o plano dele tiver franquia; os que passarem do direito recebem aviso e saem em 48h.
        </>
      ),
      confirmar: 'No fim do período', alternativa: 'Cancelar agora', cancelar: 'Voltar', perigo: true,
    });
    if (r === 'confirmar') await assinatura('cancelar');
    if (r === 'alternativa') await assinatura('cancelar_agora');
  }

  if (erro && !d) {
    return (
      <div className="rounded-xl border border-red-300 dark:border-red-900/60 p-3 text-[12px]">
        <p className="text-red-600 dark:text-red-400 font-semibold">{erro}</p>
        <button onClick={carregar} className="mt-2 h-9 px-3 rounded-lg border border-border text-[11px] font-bold inline-flex items-center gap-1.5"><RefreshCw size={12} /> Tentar de novo</button>
      </div>
    );
  }
  if (!d) return <div className="h-24 rounded-xl border border-border animate-pulse" />;

  const a = d.assinatura && !('erro' in d.assinatura) ? d.assinatura : null;

  return (
    <div className="space-y-3">
      {/* ── Bancos conectados (o que a Polp cobra de nós) ── */}
      {d.conexoes.length === 0 ? (
        <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground"><Unplug size={13} /> Nenhum banco conectado por este cliente.</p>
      ) : (
        <ul className="space-y-1.5">
          {d.conexoes.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-foreground truncate flex items-center gap-1.5">
                  {c.empresarial ? <Building2 size={12} /> : <Landmark size={12} />} {c.instituicao}{c.empresarial ? ' · PJ' : ''}
                </p>
                <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                  {c.status === 'updated'
                    ? <><CheckCircle2 size={10} className="text-emerald-500" /> sincronizando</>
                    : <><Clock size={10} className="text-amber-500" /> {c.status}</>}
                  {' · '}última {data(c.ultimaSync)} · desde {data(c.criadaEm)}
                </p>
              </div>
              <button onClick={() => desconectar(c)} disabled={!!ocupado}
                      aria-label={`Desconectar ${c.instituicao}`}
                      className="shrink-0 inline-flex items-center gap-1 h-9 px-2.5 rounded-lg border text-[11px] font-bold text-red-600 dark:text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                      style={{ borderColor: 'color-mix(in srgb, #ef4444 40%, transparent)' }}>
                {ocupado === c.id ? <Loader2 size={12} className="animate-spin" /> : <Unplug size={12} />} Desconectar
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* ── Cobrança da conexão (o que ele paga) ── */}
      {!d.assinatura ? (
        <p className="text-[11px] text-muted-foreground">
          {d.pagasNaSora > 0
            ? `Conta ${d.pagasNaSora} conexão(ões) paga(s), mas sem assinatura no Stripe (cortesia ou ajuste manual).`
            : 'Sem cobrança de conexão: o que estiver conectado é pela franquia do plano.'}
        </p>
      ) : 'erro' in d.assinatura ? (
        <p className="text-[11px] text-amber-600">Não consegui ler a assinatura no Stripe: {d.assinatura.erro}</p>
      ) : a && (
        <div className="rounded-xl border border-border bg-muted/20 px-3 py-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] font-bold text-foreground">Cobrança da conexão</p>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${a.status === 'active' && !a.cancelaNoFim ? 'bg-emerald-500/15 text-emerald-600' : a.status === 'active' ? 'bg-amber-500/15 text-amber-600' : 'bg-red-500/15 text-red-600'}`}>
              {a.status === 'active' && a.cancelaNoFim ? 'Cancelada (termina no fim)' : STATUS_STRIPE[a.status] || a.status}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {a.quantidade ?? '—'} × {a.valorUnitario != null ? `R$ ${a.valorUnitario.toFixed(2).replace('.', ',')}` : '—'} · {a.intervalo}
            {a.fimPeriodo ? ` · ${a.status !== 'active' && a.status !== 'trialing' && a.status !== 'past_due' ? 'terminou' : a.cancelaNoFim ? 'termina' : 'renova'} em ${data(a.fimPeriodo)}` : ''}
          </p>
          {d.divergencia && (
            <p className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {d.divergencia}
            </p>
          )}
          <div className="flex gap-1.5 flex-wrap">
            {a.status === 'active' && !a.cancelaNoFim && (
              <button onClick={pedirCancelamento} disabled={!!ocupado}
                      className="h-9 px-3 rounded-lg text-[11px] font-bold text-white bg-red-500 hover:bg-red-600 inline-flex items-center gap-1 disabled:opacity-50">
                {ocupado?.startsWith('cancelar') ? <Loader2 size={12} className="animate-spin" /> : <Ban size={12} />} Cancelar cobrança
              </button>
            )}
            {a.status === 'active' && a.cancelaNoFim && (
              <button onClick={() => assinatura('reativar')} disabled={!!ocupado}
                      className="h-9 px-3 rounded-lg text-[11px] font-bold border border-border text-foreground hover:bg-muted/40 inline-flex items-center gap-1 disabled:opacity-50">
                {ocupado === 'reativar' ? <Loader2 size={12} className="animate-spin" /> : <Undo2 size={12} />} Desfazer cancelamento
              </button>
            )}
            <button onClick={() => assinatura('sincronizar')} disabled={!!ocupado}
                    className={`h-9 px-3 rounded-lg text-[11px] font-bold border inline-flex items-center gap-1 disabled:opacity-50 ${d.divergencia ? 'border-amber-400 text-amber-700 dark:text-amber-400' : 'border-border text-muted-foreground hover:text-foreground'}`}>
              {ocupado === 'sincronizar' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Conferir com o Stripe
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
